import { Pool } from "@neondatabase/serverless";
import type { Car, CarStatus, Dealer, DealerCar, User, NewsArticle, ResearchArticle, Make, Model } from "@/types";
import type { SearchFilters, SearchResponse, SearchFacets, FacetBucket } from "@/lib/search";
import { expandAliases } from "@/lib/search-aliases";
import { getCentroid } from "@/lib/locations";
import { QUALITY_POLICY_CUTOFF, MIN_PUBLISH_PHOTOS, MIN_VIN_LEN, MAX_VIN_LEN } from "@/lib/quality-policy";
import { normalizeEmail } from "@/lib/email-normalize";

// Use Pool (pg-compatible) so .query(text, params) works correctly.
// The neon() tagged-template function does NOT expose a .query() method —
// using it directly caused "sql.query is not a function" at runtime.
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. " +
      "Add it to Vercel → Settings → Environment Variables.",
    );
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<Record<string, unknown>>(text, params);
  return result.rows as T[];
}

// Single source of truth for the "is this listing publicly visible?" question.
// Every public-facing query (search, detail, facets) MUST use this helper so
// /cars and /cars/[slug] can never disagree about a listing's visibility.
//
// Returns parameter-free SQL — every value is a server-controlled constant
// from lib/quality-policy.ts, so inlining is safe (no SQL injection surface)
// and avoids the $N parameter-index juggling that consolidating across many
// callers would otherwise require.
//
// Paths that must NOT call this (per the visibility matrix in the spec):
//   - getCarsByIds() — wishlist / recently-viewed must resolve hidden listings
//   - dealer dashboard queries (admin/dealer scope)
//   - admin dashboard queries
export function buildPublicListingVisibilityWhere(alias = "c"): string {
  return `${alias}.status = 'active'
    AND (
      ${alias}.created_at < DATE '${QUALITY_POLICY_CUTOFF}'
      OR (
        COALESCE(array_length(${alias}.images, 1), 0) >= ${MIN_PUBLISH_PHOTOS}
        AND ${alias}.vin IS NOT NULL
        AND LENGTH(${alias}.vin) >= ${MIN_VIN_LEN}
      )
    )`;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Users ──────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await query<User>(
    `SELECT id, name, email, image, role, created_at AS "createdAt"
     FROM users WHERE email = $1 LIMIT 1`,
    [normalizeEmail(email)],
  );
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await query<User>(
    `SELECT id, name, email, image, role, created_at AS "createdAt"
     FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getUserWithHash(
  email: string,
): Promise<(User & { passwordHash: string | null; emailVerified: boolean; isActive: boolean; provider: string; googleId: string | null }) | null> {
  const rows = await query<User & { passwordHash: string | null; emailVerified: boolean; isActive: boolean; provider: string; googleId: string | null }>(
    `SELECT id, name, email, image, role,
            password_hash      AS "passwordHash",
            email_verified     AS "emailVerified",
            COALESCE(is_active, TRUE) AS "isActive",
            provider,
            google_id          AS "googleId",
            created_at         AS "createdAt"
     FROM users WHERE email = $1 LIMIT 1`,
    [normalizeEmail(email)],
  );
  return rows[0] ?? null;
}

// PR-auth: lightweight provider check used by the credentials authorize()
// path to tell the user "this account uses Google sign-in" instead of the
// generic "invalid email/password" when password_hash IS NULL.
export interface UserAuthMethods {
  exists:       boolean;
  hasPassword:  boolean;
  hasGoogle:    boolean;
  provider:     string;
  emailVerified: boolean;
  isActive:     boolean;
}

export async function getUserAuthMethods(email: string): Promise<UserAuthMethods> {
  const rows = await query<{
    password_hash: string | null;
    google_id:     string | null;
    provider:      string;
    email_verified: boolean;
    is_active:     boolean | null;
  }>(
    `SELECT password_hash, google_id, provider, email_verified, is_active
     FROM users WHERE email = $1 LIMIT 1`,
    [normalizeEmail(email)],
  );
  const row = rows[0];
  if (!row) {
    return { exists: false, hasPassword: false, hasGoogle: false, provider: "", emailVerified: false, isActive: false };
  }
  return {
    exists:        true,
    hasPassword:   row.password_hash !== null,
    hasGoogle:     row.google_id     !== null,
    provider:      row.provider,
    emailVerified: row.email_verified === true,
    isActive:      row.is_active     !== false,
  };
}

/** Append 'google' (or 'email') to the provider field if not already present. */
function mergeProvider(current: string, add: "email" | "google"): string {
  const parts = new Set(current.split(",").map((p) => p.trim()).filter(Boolean));
  parts.add(add);
  return [...parts].sort().join(",");
}

/** Link a Google account to an existing user, marking email_verified true. */
export async function linkGoogleAccount(userId: string, googleId: string): Promise<void> {
  // Read-modify-write so we don't clobber 'email' when merging providers.
  const rows = await query<{ provider: string }>(
    `SELECT provider FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const merged = mergeProvider(rows[0]?.provider ?? "email", "google");
  await query(
    `UPDATE users
     SET google_id = $1,
         provider  = $2,
         email_verified = TRUE
     WHERE id = $3`,
    [googleId, merged, userId],
  );
}

/** Set the password hash on a user (registration or password reset). */
export async function setUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const rows = await query<{ provider: string }>(
    `SELECT provider FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const merged = mergeProvider(rows[0]?.provider ?? "email", "email");
  await query(
    `UPDATE users
     SET password_hash = $1,
         provider      = $2
     WHERE id = $3`,
    [passwordHash, merged, userId],
  );
}

/** Stamp last_login_at — fire-and-forget at the call site is fine. */
export async function updateLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId],
  );
}

/** Password-reset code helpers (30 min expiry). */
export async function setResetCode(email: string, code: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users
     SET reset_code = $1,
         reset_code_expires_at = NOW() + INTERVAL '30 minutes'
     WHERE email = $2
     RETURNING id`,
    [code, normalizeEmail(email)],
  );
  return rows.length > 0;
}

export async function consumeResetCode(email: string, code: string, newPasswordHash: string): Promise<boolean> {
  const rows = await query<{ id: string; provider: string }>(
    `SELECT id, provider FROM users
     WHERE email = $1 AND reset_code = $2 AND reset_code_expires_at > NOW()
     LIMIT 1`,
    [normalizeEmail(email), code],
  );
  const row = rows[0];
  if (!row) return false;
  const merged = mergeProvider(row.provider, "email");
  await query(
    `UPDATE users
     SET password_hash = $1,
         provider = $2,
         reset_code = NULL,
         reset_code_expires_at = NULL,
         email_verified = TRUE
     WHERE id = $3`,
    [newPasswordHash, merged, row.id],
  );
  return true;
}

export async function setVerificationCode(email: string, code: string): Promise<void> {
  await query(
    `UPDATE users
     SET verification_code = $1, verification_expires_at = NOW() + INTERVAL '15 minutes'
     WHERE email = $2`,
    [code, normalizeEmail(email)],
  );
}

export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users
     SET email_verified = TRUE, verification_code = NULL, verification_expires_at = NULL
     WHERE email = $1
       AND verification_code = $2
       AND verification_expires_at > NOW()
     RETURNING id`,
    [normalizeEmail(email), code],
  );
  return rows.length > 0;
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  await query(
    `UPDATE users SET email_verified = TRUE WHERE id = $1`,
    [userId],
  );
}

export async function createUser(data: {
  email:        string;
  name:         string;
  passwordHash?: string;
  role?:        string;
  image?:       string;
  /** 'email' | 'google' — defaults to 'email' when a password hash is supplied, 'google' otherwise. */
  provider?:    "email" | "google";
  googleId?:    string;
}): Promise<User> {
  const provider = data.provider
    ?? (data.passwordHash ? "email" : data.googleId ? "google" : "email");
  const rows = await query<User>(
    `INSERT INTO users (email, name, password_hash, role, image, provider, google_id, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, email, image, role, created_at AS "createdAt"`,
    [
      normalizeEmail(data.email),
      data.name,
      data.passwordHash ?? null,
      data.role         ?? "buyer",
      data.image        ?? null,
      provider,
      data.googleId     ?? null,
      // Google-issued emails are pre-verified by Google itself; email/password
      // accounts still need to clear the verification flow before login.
      provider === "google",
    ],
  );
  if (!rows[0]) throw new Error("User insert returned no rows");
  return rows[0];
}

export async function listUsers(): Promise<User[]> {
  // recentStrikeCount: in-window strikes recorded after the most recent
  // unsuspension event (so a fresh chance after admin reinstates them).
  // Window matches STRIKE_WINDOW_DAYS in lib/strikes.ts — change both
  // together or strikes will decay differently than they enforce.
  return query<User>(
    `SELECT u.id, u.name, u.email, u.image, u.role,
            u.is_active        AS "isActive",
            u.suspended_at     AS "suspendedAt",
            u.suspended_reason AS "suspendedReason",
            u.strike_count     AS "strikeCount",
            u.last_strike_at   AS "lastStrikeAt",
            COALESCE((
              SELECT COUNT(*) FROM admin_logs al
              WHERE al.target_type = 'user'
                AND al.target_id   = u.id
                AND al.action      = 'user_strike'
                AND al.created_at  > NOW() - INTERVAL '30 days'
                AND al.created_at  > COALESCE((
                  SELECT MAX(created_at) FROM admin_logs
                  WHERE target_type = 'user' AND target_id = u.id
                    AND action      = 'user_unsuspend'
                ), '1970-01-01'::timestamptz)
            ), 0)::INT          AS "recentStrikeCount",
            u.created_at       AS "createdAt"
     FROM users u ORDER BY u.created_at DESC`,
  );
}

export async function updateUserRole(id: string, role: string): Promise<void> {
  await query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
}

// ── Dealers ────────────────────────────────────────────────

export async function createDealer(data: {
  userId: string;
  businessName: string;
  businessReg: string;
  kraPin: string;
  directorName: string;
  directorIdUrl: string;
  businessCertUrl: string;
  phone: string;
  location: string;
  status?: "pending" | "approved" | "rejected";
}): Promise<Dealer> {
  // Public-profile slug (/dealers/[slug]). Random suffix keeps it unique even
  // when two dealers share a business name.
  const slug = `${slugify(data.businessName)}-${Math.random().toString(36).slice(2, 7)}`;
  const rows = await query<Dealer>(
    `INSERT INTO dealers
       (user_id, business_name, business_reg, kra_pin, director_name,
        director_id_url, business_cert_url, phone, location, status, slug)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE($10, 'pending'), $11)
     RETURNING
       id, user_id AS "userId", business_name AS "businessName",
       business_reg AS "businessReg", kra_pin AS "kraPin",
       director_name AS "directorName", director_id_url AS "directorIdUrl",
       business_cert_url AS "businessCertUrl", phone, location, status,
       rejection_reason AS "rejectionReason",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      data.userId, data.businessName, data.businessReg, data.kraPin,
      data.directorName, data.directorIdUrl, data.businessCertUrl,
      data.phone, data.location, data.status ?? null, slug,
    ],
  );
  return rows[0];
}

export interface DealerProfile {
  id: string;
  slug: string;
  businessName: string;
  location: string;
  phone: string;
  status: string;
  createdAt: string;
}

// Public-profile slug for the dealer that owns a car (null for private /
// login-free listings). Used to deep-link a listing to its dealer profile.
export async function getDealerSlugForCar(carId: string): Promise<string | null> {
  const rows = await query<{ slug: string | null }>(
    `SELECT d.slug FROM cars c JOIN dealers d ON d.id = c.dealer_id WHERE c.id = $1 LIMIT 1`,
    [carId],
  );
  return rows[0]?.slug ?? null;
}

export async function getDealerProfileBySlug(slug: string): Promise<DealerProfile | null> {
  const rows = await query<DealerProfile>(
    `SELECT id, slug, business_name AS "businessName", location, phone, status,
            created_at AS "createdAt"
     FROM dealers WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function getDealerByUserId(userId: string): Promise<Dealer | null> {
  const rows = await query<Dealer>(
    `SELECT d.id, d.user_id AS "userId", d.business_name AS "businessName",
            d.business_reg AS "businessReg", d.kra_pin AS "kraPin",
            d.director_name AS "directorName", d.director_id_url AS "directorIdUrl",
            d.business_cert_url AS "businessCertUrl", d.phone, d.location,
            d.status, d.rejection_reason AS "rejectionReason",
            d.created_at AS "createdAt", d.updated_at AS "updatedAt",
            u.name AS "userName", u.email AS "userEmail"
     FROM dealers d JOIN users u ON u.id = d.user_id
     WHERE d.user_id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function getDealerById(id: string): Promise<Dealer | null> {
  const rows = await query<Dealer>(
    `SELECT d.id, d.user_id AS "userId", d.business_name AS "businessName",
            d.business_reg AS "businessReg", d.kra_pin AS "kraPin",
            d.director_name AS "directorName", d.director_id_url AS "directorIdUrl",
            d.business_cert_url AS "businessCertUrl", d.phone, d.location,
            d.status, d.rejection_reason AS "rejectionReason",
            d.created_at AS "createdAt", d.updated_at AS "updatedAt",
            u.name AS "userName", u.email AS "userEmail"
     FROM dealers d JOIN users u ON u.id = d.user_id
     WHERE d.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listDealers(status?: string): Promise<Dealer[]> {
  const where = status ? "WHERE d.status = $1" : "";
  const params = status ? [status] : [];
  // recentStrikeCount: see listUsers for the rationale — mirrors the rolling
  // 30-day window in lib/strikes.ts, but only counts strikes after the
  // most recent unsuspension event (clean slate after admin reinstates).
  return query<Dealer>(
    `SELECT d.id, d.user_id AS "userId", d.business_name AS "businessName",
            d.business_reg AS "businessReg", d.kra_pin AS "kraPin",
            d.director_name AS "directorName", d.director_id_url AS "directorIdUrl",
            d.business_cert_url AS "businessCertUrl", d.phone, d.location,
            d.status, d.rejection_reason AS "rejectionReason",
            d.is_active         AS "isActive",
            d.suspended_at      AS "suspendedAt",
            d.suspension_reason AS "suspensionReason",
            d.strike_count      AS "strikeCount",
            d.last_strike_at    AS "lastStrikeAt",
            COALESCE((
              SELECT COUNT(*) FROM admin_logs al
              WHERE al.target_type = 'dealer'
                AND al.target_id   = d.id
                AND al.action      = 'dealer_strike'
                AND al.created_at  > NOW() - INTERVAL '30 days'
                AND al.created_at  > COALESCE((
                  SELECT MAX(created_at) FROM admin_logs
                  WHERE target_type = 'dealer' AND target_id = d.id
                    AND action      = 'dealer_unsuspend'
                ), '1970-01-01'::timestamptz)
            ), 0)::INT          AS "recentStrikeCount",
            d.created_at AS "createdAt", d.updated_at AS "updatedAt",
            u.name AS "userName", u.email AS "userEmail"
     FROM dealers d JOIN users u ON u.id = d.user_id
     ${where}
     ORDER BY d.created_at DESC`,
    params,
  );
}

export async function updateDealerStatus(
  id: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
): Promise<void> {
  await query(
    `UPDATE dealers SET status = $1, rejection_reason = $2, updated_at = NOW()
     WHERE id = $3`,
    [status, rejectionReason ?? null, id],
  );
  if (status === "approved") {
    await query(
      `UPDATE users SET role = 'dealer'
       WHERE id = (SELECT user_id FROM dealers WHERE id = $1)`,
      [id],
    );
    // Stamp the "verified" trust-timeline milestone (idempotent).
    await query(
      `INSERT INTO dealer_milestones (dealer_id, type, threshold, label)
       VALUES ($1, 'verified', 0, 'Verified business')
       ON CONFLICT (dealer_id, type, threshold) DO NOTHING`,
      [id],
    ).catch(() => {});
  }
}

// ── Cars ───────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createDealerCar(
  dealerId: string,
  data: Omit<DealerCar, "id" | "dealerId" | "slug" | "createdAt" | "updatedAt" | "views" | "inquiries">,
): Promise<DealerCar> {
  const base   = slugify(`${data.year}-${data.make}-${data.model}`);
  const suffix = Math.random().toString(36).slice(2, 7);
  const slug   = `${base}-${suffix}`;

  // PR7: publish-quality guard. Active listings require >= MIN photos AND a VIN.
  // Drafts can be saved with anything so dealers can stage incomplete records.
  // PR2: also refuse the publish if the dealer has been suspended.
  const status: CarStatus = (data.status ?? "active") as CarStatus;
  if (status === "active") {
    await assertActorActive("dealer", dealerId);
    enforcePublishQuality(data.images, data.vin);
  }

  const centroid = getCentroid(data.location);
  const specsJson = JSON.stringify(data.specifications ?? {});
  const rows = await query<DealerCar>(
    `INSERT INTO cars
       (dealer_id, slug, year, make, model, trim, price, mileage, fuel,
        transmission, body_type, condition, location, description, images, features,
        financing_available, hire_purchase_available,
        drivetrain, engine_size_l, previous_owners, exterior_color, interior_color, seller_type,
        latitude, longitude, status,
        vin, vin_verified, service_history_available, ownership_verified, inspection_available,
        specifications,
        registration_number, mileage_verified, logbook_verified, accident_history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34,$35,$36,$37)
     RETURNING
       id, dealer_id AS "dealerId", slug, year, make, model, trim,
       price, mileage, fuel, transmission,
       body_type AS "bodyType", condition, location, description,
       images, features, verified, status,
       financing_available  AS "financingAvailable",
       hire_purchase_available AS "hirePurchaseAvailable",
       drivetrain,
       engine_size_l    AS "engineSizeL",
       previous_owners  AS "previousOwners",
       exterior_color   AS "exteriorColor",
       interior_color   AS "interiorColor",
       seller_type      AS "sellerType",
       specifications,
       registration_number AS "registrationNumber",
       mileage_verified    AS "mileageVerified",
       logbook_verified    AS "logbookVerified",
       accident_history    AS "accidentHistory",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      dealerId, slug, data.year, data.make, data.model, data.trim ?? null,
      data.price, data.mileage, data.fuel, data.transmission, data.bodyType,
      data.condition, data.location, data.description,
      data.images, data.features,
      data.financingAvailable  ?? false,
      data.hirePurchaseAvailable ?? false,
      data.drivetrain     ?? null,
      data.engineSizeL    ?? null,
      data.previousOwners ?? null,
      data.exteriorColor  ?? null,
      data.interiorColor  ?? null,
      "dealer",
      centroid?.lat ?? null,
      centroid?.lng ?? null,
      status,
      data.vin                     ?? null,
      data.vinVerified             ?? false,
      data.serviceHistoryAvailable ?? false,
      data.ownershipVerified       ?? false,
      data.inspectionAvailable     ?? false,
      specsJson,
      data.registrationNumber?.trim() || null,
      data.mileageVerified ?? false,
      data.logbookVerified ?? false,
      data.accidentHistory ?? null,
    ],
  );
  return rows[0];
}

// PR7: shared publish-quality guard for new listings. Drafts skip this.
// Thresholds live in lib/quality-policy.ts so the same numbers govern insert,
// update, search-time filtering, the audit query, and admin metrics.
function enforcePublishQuality(images: string[] | undefined, vin: string | null | undefined): void {
  const photoCount = images?.length ?? 0;
  if (photoCount < MIN_PUBLISH_PHOTOS) {
    throw new ListingQualityError(`Published listings require at least ${MIN_PUBLISH_PHOTOS} photos (${photoCount} supplied). Save as draft to finish later.`);
  }
  const vinLen = (vin ?? "").trim().length;
  if (vinLen < MIN_VIN_LEN || vinLen > MAX_VIN_LEN) {
    throw new ListingQualityError(`Published listings require a VIN between ${MIN_VIN_LEN} and ${MAX_VIN_LEN} characters (${vinLen} supplied). Save as draft to finish later.`);
  }
}

export class ListingQualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingQualityError";
  }
}

// PR2 strike system: refuses any publish path when the actor has been
// suspended (manually by an admin or automatically after crossing the
// strike threshold). Throws ListingQualityError so the API layer can
// surface the message verbatim to the suspended dealer/seller without
// extra error handling — the message explains *why* in their words.
//
// Returns silently when the actor is not suspended.
export async function assertActorActive(
  actorType: "dealer" | "user",
  actorId:   string,
): Promise<void> {
  const table = actorType === "dealer" ? "dealers" : "users";
  const reasonCol = actorType === "dealer" ? "suspension_reason" : "suspended_reason";
  const rows = await query<{ isActive: boolean; reason: string | null }>(
    `SELECT is_active AS "isActive", ${reasonCol} AS "reason"
     FROM ${table} WHERE id = $1 LIMIT 1`,
    [actorId],
  );
  const row = rows[0];
  if (!row) return; // unknown actor — let downstream FK / auth fail clearly
  if (row.isActive) return;
  const detail = row.reason ? ` (${row.reason})` : "";
  throw new ListingQualityError(
    `Your account is suspended${detail}. Contact support to restore publishing.`,
  );
}

// Create a listing with NO dealer/seller account attached. Used by the
// login-free public posting flow — buyers reach the seller via the
// seller_name / seller_phone captured on the form.
export async function createPublicCar(
  data: Omit<
    DealerCar,
    "id" | "dealerId" | "slug" | "createdAt" | "updatedAt" | "views" | "inquiries" | "verified" | "status"
  > & { sellerName: string; sellerPhone: string },
): Promise<DealerCar> {
  const base   = slugify(`${data.year}-${data.make}-${data.model}`);
  const suffix = Math.random().toString(36).slice(2, 7);
  const slug   = `${base}-${suffix}`;

  // PR7: same publish-quality bar for login-free listings.
  enforcePublishQuality(data.images, data.vin);

  const centroid = getCentroid(data.location);
  // JSONB column expects a string; PG node driver does the parse on the way back.
  const specsJson = JSON.stringify(data.specifications ?? {});
  const rows = await query<DealerCar>(
    `INSERT INTO cars
       (slug, year, make, model, trim, price, mileage, fuel,
        transmission, body_type, condition, location, description, images, features,
        financing_available, hire_purchase_available, seller_name, seller_phone,
        drivetrain, engine_size_l, previous_owners, exterior_color, interior_color, seller_type,
        latitude, longitude,
        vin, vin_verified, service_history_available, ownership_verified, inspection_available,
        specifications,
        registration_number, mileage_verified, logbook_verified, accident_history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34,$35,$36,$37)
     RETURNING
       id, dealer_id AS "dealerId", slug, year, make, model, trim,
       price, mileage, fuel, transmission,
       body_type AS "bodyType", condition, location, description,
       images, features, verified, status,
       financing_available  AS "financingAvailable",
       hire_purchase_available AS "hirePurchaseAvailable",
       drivetrain,
       engine_size_l    AS "engineSizeL",
       previous_owners  AS "previousOwners",
       exterior_color   AS "exteriorColor",
       interior_color   AS "interiorColor",
       seller_type      AS "sellerType",
       specifications,
       registration_number AS "registrationNumber",
       mileage_verified    AS "mileageVerified",
       logbook_verified    AS "logbookVerified",
       accident_history    AS "accidentHistory",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      slug, data.year, data.make, data.model, data.trim ?? null,
      data.price, data.mileage, data.fuel, data.transmission, data.bodyType,
      data.condition, data.location, data.description,
      data.images, data.features,
      data.financingAvailable  ?? false,
      data.hirePurchaseAvailable ?? false,
      data.sellerName, data.sellerPhone,
      data.drivetrain     ?? null,
      data.engineSizeL    ?? null,
      data.previousOwners ?? null,
      data.exteriorColor  ?? null,
      data.interiorColor  ?? null,
      "login_free",
      centroid?.lat ?? null,
      centroid?.lng ?? null,
      data.vin                     ?? null,
      data.vinVerified             ?? false,
      data.serviceHistoryAvailable ?? false,
      data.ownershipVerified       ?? false,
      data.inspectionAvailable     ?? false,
      specsJson,
      data.registrationNumber?.trim() || null,
      data.mileageVerified ?? false,
      data.logbookVerified ?? false,
      data.accidentHistory ?? null,
    ],
  );
  return rows[0];
}

export async function getDealerCars(dealerId: string): Promise<DealerCar[]> {
  return query<DealerCar>(
    `SELECT c.id, c.dealer_id AS "dealerId", c.slug, c.year, c.make, c.model,
            c.trim, c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location, c.description,
            c.images, c.features, c.verified, c.status,
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COUNT(DISTINCT v.id)::INT  AS views,
            COUNT(DISTINCT cr.id)::INT AS inquiries
     FROM cars c
     LEFT JOIN car_views       v  ON v.car_id  = c.id
     LEFT JOIN contact_requests cr ON cr.car_id = c.id
     WHERE c.dealer_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [dealerId],
  );
}

// Admin-facing: returns EVERY listing in the cars table regardless of status,
// including hidden / archived / rejected — so /admin/cars can moderate them.
// Public surfaces must use getPublicCars() / buildPublicListingVisibilityWhere().
export async function getAllDbCars(): Promise<DealerCar[]> {
  return query<DealerCar>(
    `SELECT c.id, c.dealer_id AS "dealerId", c.slug, c.year, c.make,
            c.model, c.trim, c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location, c.description,
            c.images, c.features, c.verified, c.status,
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.moderated_by     AS "moderatedBy",
            c.moderated_at     AS "moderatedAt",
            c.moderation_reason AS "moderationReason",
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COUNT(DISTINCT v.id)::INT AS views
     FROM cars c
     LEFT JOIN car_views v ON v.car_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
  );
}

export async function getPublicCars(opts: {
  search?: string;
  makes?: string[];
  bodies?: string[];
  fuels?: string[];
  locations?: string[];
  condition?: string;
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  financing?: boolean;
  hirePurchase?: boolean;
  sort?: "recent" | "trust";
} = {}): Promise<Car[]> {
  // Public visibility — single source of truth (status + grandfather + photo/VIN).
  const conditions: string[] = [buildPublicListingVisibilityWhere("c")];
  const params: unknown[]   = [];
  let idx = 1;

  if (opts.search) {
    conditions.push(
      `(c.make ILIKE $${idx} OR c.model ILIKE $${idx} OR c.trim ILIKE $${idx})`,
    );
    params.push(`%${opts.search}%`);
    idx++;
  }
  if (opts.makes?.length) {
    conditions.push(`c.make = ANY($${idx})`);
    params.push(opts.makes);
    idx++;
  }
  if (opts.bodies?.length) {
    conditions.push(`c.body_type = ANY($${idx})`);
    params.push(opts.bodies);
    idx++;
  }
  if (opts.fuels?.length) {
    conditions.push(`c.fuel = ANY($${idx})`);
    params.push(opts.fuels);
    idx++;
  }
  if (opts.locations?.length) {
    conditions.push(`c.location = ANY($${idx})`);
    params.push(opts.locations);
    idx++;
  }
  if (opts.condition) {
    conditions.push(`c.condition = $${idx}`);
    params.push(opts.condition);
    idx++;
  }
  if (opts.transmission) {
    conditions.push(`c.transmission = $${idx}`);
    params.push(opts.transmission);
    idx++;
  }
  if (opts.minPrice !== undefined) {
    conditions.push(`c.price >= $${idx}`);
    params.push(opts.minPrice);
    idx++;
  }
  if (opts.maxPrice !== undefined) {
    conditions.push(`c.price <= $${idx}`);
    params.push(opts.maxPrice);
    idx++;
  }
  if (opts.financing)    conditions.push("c.financing_available = TRUE");
  if (opts.hirePurchase) conditions.push("c.hire_purchase_available = TRUE");

  const where = conditions.join(" AND ");

  type Row = {
    id: string; slug: string; year: number; make: string; model: string;
    trim: string | null; price: number; mileage: number; fuel: string;
    transmission: string; bodyType: string; condition: string; location: string;
    description: string; images: string[]; features: string[]; verified: boolean;
    financingAvailable: boolean; hirePurchaseAvailable: boolean; createdAt: string;
    dealerName: string | null; dealerLocation: string | null; dealerPhone: string | null;
    dealerSlug: string | null; dealerScore: number | null; dealerVerified: boolean | null;
    dealerRating: string | null; dealerReviews: string | null; dealerRecommend: string | null;
  };

  // Trust-aware sort surfaces high-score dealers first; default is most recent.
  const orderBy = opts.sort === "trust"
    ? `d.score DESC NULLS LAST, c.is_featured DESC, c.created_at DESC`
    : `c.created_at DESC`;

  const rows = await query<Row>(
    `SELECT c.id, c.slug, c.year, c.make, c.model, c.trim,
            c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location,
            c.description, c.images, c.features, c.verified,
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.created_at AS "createdAt",
            COALESCE(d.business_name, c.seller_name) AS "dealerName",
            COALESCE(d.location, c.location)         AS "dealerLocation",
            COALESCE(d.phone, c.seller_phone)        AS "dealerPhone",
            d.slug AS "dealerSlug",
            d.score AS "dealerScore",
            (d.status = 'approved') AS "dealerVerified",
            rv.avg_rating  AS "dealerRating",
            rv.review_count AS "dealerReviews",
            rv.recommend_pct AS "dealerRecommend"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     LEFT JOIN (
       SELECT dealer_id,
              AVG(rating)::NUMERIC(3,2) AS avg_rating,
              COUNT(*)                  AS review_count,
              (AVG(CASE WHEN would_recommend IS TRUE THEN 1.0
                        WHEN would_recommend IS FALSE THEN 0.0 END) * 100) AS recommend_pct
       FROM reviews WHERE status = 'published'
       GROUP BY dealer_id
     ) rv ON rv.dealer_id = c.dealer_id
     WHERE ${where}
     ORDER BY ${orderBy}`,
    params,
  );

  return rows.map((r) => ({
    id: r.id, slug: r.slug, year: r.year, make: r.make, model: r.model,
    trim: r.trim ?? undefined,
    price: Number(r.price),
    mileage: r.mileage,
    fuel: r.fuel as Car["fuel"],
    transmission: r.transmission as Car["transmission"],
    bodyType: r.bodyType as Car["bodyType"],
    condition: r.condition as Car["condition"],
    location: r.location,
    description: r.description,
    images: r.images?.length ? r.images : ["/placeholder-car.jpg"],
    features: r.features ?? [],
    verified: r.verified,
    financingAvailable:    r.financingAvailable,
    hirePurchaseAvailable: r.hirePurchaseAvailable,
    createdAt: r.createdAt,
    dealer: {
      name:     r.dealerName     ?? "Agnora Dealer",
      rating:   r.dealerRating   != null ? Number(r.dealerRating) : 0,
      reviews:  r.dealerReviews  != null ? Number(r.dealerReviews) : 0,
      location: r.dealerLocation ?? "",
      phone:    r.dealerPhone    ?? "",
      slug:     r.dealerSlug     ?? undefined,
      score:    r.dealerScore    ?? null,
      verified: r.dealerVerified ?? false,
      recommendPct: r.dealerRecommend != null ? Number(r.dealerRecommend) : null,
    },
  }));
}

export async function updateDealerCar(
  id: string,
  dealerId: string,
  data: Partial<DealerCar>,
): Promise<void> {
  // PR9: close the update-quality loophole. Before generating the UPDATE, look
  // at the post-merge images + vin. If the resulting status is "active", the
  // car must still pass enforcePublishQuality(). Drafts are intentionally
  // exempt — dealers can stage incomplete records as drafts.
  const wantsActive = data.status === "active" || data.status === undefined;
  if (wantsActive) {
    const rows = await query<{ images: string[]; vin: string | null; status: CarStatus }>(
      `SELECT images, vin, status FROM cars WHERE id = $1 AND dealer_id = $2 LIMIT 1`,
      [id, dealerId],
    );
    const current = rows[0];
    if (current) {
      const resultingStatus = (data.status ?? current.status) as CarStatus;
      if (resultingStatus === "active") {
        // PR2: refuse to (re-)publish if the owning dealer has been suspended.
        await assertActorActive("dealer", dealerId);
        const finalImages = data.images ?? current.images ?? [];
        const finalVin    = data.vin    ?? current.vin    ?? null;
        enforcePublishQuality(finalImages, finalVin);
      }
    }
  }

  const sets: string[]    = [];
  const vals: unknown[]   = [];
  let i = 1;

  const fieldMap: Record<string, string> = {
    year: "year", make: "make", model: "model", trim: "trim",
    price: "price", mileage: "mileage", fuel: "fuel",
    transmission: "transmission", bodyType: "body_type",
    condition: "condition", location: "location",
    description: "description", images: "images",
    features: "features", status: "status",
    financingAvailable:    "financing_available",
    hirePurchaseAvailable: "hire_purchase_available",
    // PR4b/PR6b — make these editable, otherwise dealers can't backfill a VIN
    // or add trust flags after the listing has gone live.
    drivetrain:              "drivetrain",
    engineSizeL:             "engine_size_l",
    previousOwners:          "previous_owners",
    exteriorColor:           "exterior_color",
    interiorColor:           "interior_color",
    vin:                     "vin",
    vinVerified:             "vin_verified",
    serviceHistoryAvailable: "service_history_available",
    ownershipVerified:       "ownership_verified",
    inspectionAvailable:     "inspection_available",
    // 2026-06-22 trust fields.
    registrationNumber:      "registration_number",
    mileageVerified:         "mileage_verified",
    logbookVerified:         "logbook_verified",
    accidentHistory:         "accident_history",
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in data) {
      sets.push(`${col} = $${i++}`);
      vals.push((data as Record<string, unknown>)[key]);
    }
  }

  // specifications is JSONB — serialise + cast separately. Treat undefined
  // as "no change" (so partial updates don't blow the existing object away)
  // and {} as "explicit reset". Matches createDealerCar's contract.
  if ("specifications" in data && data.specifications !== undefined) {
    sets.push(`specifications = $${i++}::jsonb`);
    vals.push(JSON.stringify(data.specifications));
  }

  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  vals.push(id, dealerId);

  await query(
    `UPDATE cars SET ${sets.join(", ")} WHERE id = $${i} AND dealer_id = $${i + 1}`,
    vals,
  );
}

// PR9: nightly-audit query. Returns active listings that violate the quality
// bar — used by the admin "Non-compliant listings" panel and by a future
// scheduled job. Ordered most-recently-updated first per spec.
export interface NonCompliantListing {
  id:                string;
  slug:              string;
  year:              number;
  make:              string;
  model:             string;
  photoCount:        number;
  vin:               string | null;
  vinLength:         number;
  missingPhotos:     boolean;
  missingVin:        boolean;
  dealerName:        string | null;
  updatedAt:         string;
}

export async function getNonCompliantListings(limit = 50): Promise<NonCompliantListing[]> {
  const rows = await query<{
    id: string; slug: string; year: number; make: string; model: string;
    photoCount: number; vin: string | null; vinLength: number;
    dealerName: string | null; updatedAt: string;
  }>(
    `SELECT c.id, c.slug, c.year, c.make, c.model,
            COALESCE(array_length(c.images, 1), 0)::INT AS "photoCount",
            c.vin,
            COALESCE(LENGTH(c.vin), 0)::INT             AS "vinLength",
            COALESCE(d.business_name, c.seller_name)    AS "dealerName",
            c.updated_at                                AS "updatedAt"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     WHERE c.status = 'active'
       AND (
            COALESCE(array_length(c.images, 1), 0) < $1
         OR c.vin IS NULL
         OR LENGTH(c.vin) < $2
       )
     ORDER BY c.updated_at DESC
     LIMIT $3`,
    [MIN_PUBLISH_PHOTOS, MIN_VIN_LEN, limit],
  );

  return rows.map((r) => ({
    id:            r.id,
    slug:          r.slug,
    year:          r.year,
    make:          r.make,
    model:         r.model,
    photoCount:    r.photoCount,
    vin:           r.vin,
    vinLength:     r.vinLength,
    missingPhotos: r.photoCount < MIN_PUBLISH_PHOTOS,
    missingVin:    !r.vin || r.vinLength < MIN_VIN_LEN,
    dealerName:    r.dealerName,
    updatedAt:     r.updatedAt,
  }));
}

// PR-policy: Option A compliance metrics. Single round-trip via FILTER aggregates.
// grandfathered = active listings created before the cutoff (always visible).
// compliant     = active listings created on/after cutoff and meeting the bar.
// hidden        = active listings created on/after cutoff and failing the bar
//                 (these are the ones the public search clause is hiding).
export interface ComplianceStats {
  grandfathered: number;
  compliant:     number;
  hidden:        number;
}

export async function getListingComplianceStats(): Promise<ComplianceStats> {
  const rows = await query<ComplianceStats>(
    `SELECT
       COUNT(*) FILTER (WHERE c.created_at < $1::date)::INT
         AS grandfathered,
       COUNT(*) FILTER (
         WHERE c.created_at >= $1::date
           AND COALESCE(array_length(c.images, 1), 0) >= $2
           AND c.vin IS NOT NULL
           AND LENGTH(c.vin) >= $3
       )::INT AS compliant,
       COUNT(*) FILTER (
         WHERE c.created_at >= $1::date
           AND (
                COALESCE(array_length(c.images, 1), 0) < $2
             OR c.vin IS NULL
             OR LENGTH(c.vin) < $3
           )
       )::INT AS hidden
     FROM cars c
     WHERE c.status = 'active'`,
    [QUALITY_POLICY_CUTOFF, MIN_PUBLISH_PHOTOS, MIN_VIN_LEN],
  );
  return rows[0] ?? { grandfathered: 0, compliant: 0, hidden: 0 };
}

export async function deleteDealerCar(id: string, dealerId: string): Promise<void> {
  await query("DELETE FROM cars WHERE id = $1 AND dealer_id = $2", [id, dealerId]);
}

// ── Admin moderation ──────────────────────────────────────────
// Soft-status change (hidden / archived / rejected / active / sold). The caller
// MUST have already verified the session is an admin — this helper does NOT
// re-check. Stamping moderated_by/at/reason lets the seller see *why* their
// listing was taken down without joining admin_logs.
export async function adminModerateCar(
  carId: string,
  adminId: string,
  newStatus: CarStatus,
  reason: string | null,
): Promise<void> {
  await query(
    `UPDATE cars
     SET status            = $1,
         moderated_by      = $2,
         moderated_at      = NOW(),
         moderation_reason = $3,
         updated_at        = NOW()
     WHERE id = $4`,
    [newStatus, adminId, reason, carId],
  );
}

// True delete — irreversible, admin-only. Used when a listing is spam / fraud
// / illegal and must not appear in analytics or recovery flows. Prefer
// adminModerateCar(..., 'archived') for ordinary takedowns.
export async function adminDeleteCar(carId: string): Promise<void> {
  await query("DELETE FROM cars WHERE id = $1", [carId]);
}

// Finds active listings sharing a VIN with another non-archived listing.
// The *newer* car in each pair is returned as the duplicate (oldest wins —
// usually the legitimate first listing). VIN comparison is case-insensitive
// and trimmed; null/short VINs are skipped (those failures get caught by
// getNonCompliantListings instead).
export interface DuplicateVin {
  id: string;
  slug: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  dealerId: string | null;
  createdAt: string;
  originalId: string;        // The older listing kept active
  originalCreatedAt: string;
}

export async function findDuplicateVins(limit = 200): Promise<DuplicateVin[]> {
  const rows = await query<DuplicateVin>(
    `WITH ranked AS (
       SELECT id, slug, UPPER(TRIM(vin)) AS vin, year, make, model,
              dealer_id AS "dealerId", created_at AS "createdAt",
              ROW_NUMBER() OVER (
                PARTITION BY UPPER(TRIM(vin)) ORDER BY created_at ASC
              ) AS rn,
              FIRST_VALUE(id)         OVER (PARTITION BY UPPER(TRIM(vin)) ORDER BY created_at ASC) AS "originalId",
              FIRST_VALUE(created_at) OVER (PARTITION BY UPPER(TRIM(vin)) ORDER BY created_at ASC) AS "originalCreatedAt"
       FROM cars
       WHERE status = 'active'
         AND vin IS NOT NULL
         AND LENGTH(TRIM(vin)) >= $1
     )
     SELECT id, slug, vin, year, make, model, "dealerId", "createdAt",
            "originalId", "originalCreatedAt"
     FROM ranked
     WHERE rn > 1
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [MIN_VIN_LEN, limit],
  );
  return rows;
}

// Loads any car by id regardless of status — used by admin moderation endpoints
// that must operate on hidden / archived rows the public visibility helper hides.
export async function getCarByIdAdmin(carId: string): Promise<DealerCar | null> {
  const rows = await query<DealerCar>(
    `SELECT id, dealer_id AS "dealerId", slug, year, make, model, trim, price,
            mileage, fuel, transmission, body_type AS "bodyType", condition,
            location, description, images, features, verified, status,
            moderated_by AS "moderatedBy", moderated_at AS "moderatedAt",
            moderation_reason AS "moderationReason",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM cars WHERE id = $1
     LIMIT 1`,
    [carId],
  );
  return rows[0] ?? null;
}

// ── Analytics ──────────────────────────────────────────────

export async function getAdminStats() {
  const [cars, dealers, users, pending, searches, contacts] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM cars WHERE status = 'active'"),
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM dealers WHERE status = 'approved'"),
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM users"),
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM dealers WHERE status = 'pending'"),
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM search_events"),
    query<{ count: string }>("SELECT COUNT(*)::TEXT AS count FROM contact_requests"),
  ]);

  return {
    totalCars:     Number(cars[0]?.count     ?? 0),
    totalDealers:  Number(dealers[0]?.count  ?? 0),
    totalUsers:    Number(users[0]?.count    ?? 0),
    pendingDealers: Number(pending[0]?.count ?? 0),
    totalSearches:  Number(searches[0]?.count ?? 0),
    totalContacts:  Number(contacts[0]?.count ?? 0),
  };
}

// Executive marketplace-health KPIs (V10000 capstone). One round-trip of
// subselects — meant for the platform admin to watch whether the marketplace
// is getting healthier over time, not a per-dealer feature.
export interface MarketplaceHealth {
  activeDealers: number;
  activeListings: number;
  listingViews: number;
  contactOpens: number;
  leads: number;
  wonLeads: number;
  leadConversion: number | null;     // won / leads (0–1)
  avgDealerScore: number | null;
  avgResponseHours: number | null;
  avgResolutionHours: number | null;
}

export async function getMarketplaceHealth(): Promise<MarketplaceHealth> {
  const rows = await query<{
    activeDealers: string; activeListings: string; listingViews: string;
    contactOpens: string; leads: string; wonLeads: string;
    avgScore: string | null; avgResponseSecs: string | null; avgResolutionSecs: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM dealers WHERE status = 'approved' AND is_active)::TEXT AS "activeDealers",
       (SELECT COUNT(*) FROM cars WHERE status = 'active')::TEXT AS "activeListings",
       (SELECT COUNT(*) FROM car_views)::TEXT AS "listingViews",
       (SELECT COUNT(*) FROM analytics_events WHERE name = 'contact_form_open')::TEXT AS "contactOpens",
       (SELECT COUNT(*) FROM contact_requests)::TEXT AS "leads",
       (SELECT COUNT(*) FROM contact_requests WHERE status = 'won')::TEXT AS "wonLeads",
       (SELECT AVG(score) FROM dealers WHERE score IS NOT NULL)::TEXT AS "avgScore",
       (SELECT AVG(EXTRACT(EPOCH FROM (last_contact_at - created_at)))
          FROM contact_requests WHERE last_contact_at IS NOT NULL)::TEXT AS "avgResponseSecs",
       (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
          FROM complaints WHERE status IN ('resolved', 'dismissed'))::TEXT AS "avgResolutionSecs"`,
  );
  const r = rows[0];
  const leads = Number(r?.leads ?? 0);
  const wonLeads = Number(r?.wonLeads ?? 0);
  return {
    activeDealers:  Number(r?.activeDealers ?? 0),
    activeListings: Number(r?.activeListings ?? 0),
    listingViews:   Number(r?.listingViews ?? 0),
    contactOpens:   Number(r?.contactOpens ?? 0),
    leads,
    wonLeads,
    leadConversion: leads > 0 ? wonLeads / leads : null,
    avgDealerScore: r?.avgScore != null ? Number(r.avgScore) : null,
    avgResponseHours: r?.avgResponseSecs != null ? Number(r.avgResponseSecs) / 3600 : null,
    avgResolutionHours: r?.avgResolutionSecs != null ? Number(r.avgResolutionSecs) / 3600 : null,
  };
}

export async function getTopSearchedMakes(limit = 8) {
  return query<{ make: string; count: string }>(
    `SELECT make, COUNT(*)::TEXT AS count
     FROM search_events WHERE make IS NOT NULL
     GROUP BY make ORDER BY COUNT(*) DESC LIMIT $1`,
    [limit],
  );
}

export async function getMostViewedCars(limit = 5) {
  return query<{ id: string; make: string; model: string; year: number; views: string }>(
    `SELECT c.id, c.make, c.model, c.year, COUNT(v.id)::TEXT AS views
     FROM cars c JOIN car_views v ON v.car_id = c.id
     GROUP BY c.id ORDER BY COUNT(v.id) DESC LIMIT $1`,
    [limit],
  );
}

export async function getDailyViews(days = 14) {
  return query<{ date: string; views: string }>(
    `SELECT DATE(created_at)::TEXT AS date, COUNT(*)::TEXT AS views
     FROM car_views
     WHERE created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at) ORDER BY date ASC`,
  );
}

export async function recordCarView(carId: string, userAgent?: string, ipHash?: string) {
  await query(
    "INSERT INTO car_views (car_id, user_agent, ip_hash) VALUES ($1, $2, $3)",
    [carId, userAgent ?? null, ipHash ?? null],
  );
}

export async function recordSearch(data: {
  query?: string; make?: string; model?: string; condition?: string;
  minPrice?: number; maxPrice?: number; resultsCount?: number;
}) {
  await query(
    `INSERT INTO search_events
       (query, make, model, condition, min_price, max_price, results_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      data.query ?? null, data.make ?? null, data.model ?? null,
      data.condition ?? null, data.minPrice ?? null,
      data.maxPrice ?? null, data.resultsCount ?? null,
    ],
  );
}

// ── Subscriptions ──────────────────────────────────────────

export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const rows = await query<Subscription>(
    `SELECT id, user_id AS "userId", plan, status,
            expires_at AS "expiresAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  // Auto-create free subscription if missing
  if (!rows[0]) {
    await query(
      `INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'free', 'active')
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    return { id: "", userId, plan: "free", status: "active", expiresAt: null,
             createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  return rows[0];
}

export async function upsertSubscription(
  userId: string,
  plan: string,
  expiresAt?: Date | null,
): Promise<void> {
  await query(
    `INSERT INTO subscriptions (user_id, plan, status, expires_at, updated_at)
     VALUES ($1, $2, 'active', $3, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = 'active',
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
    [userId, plan, expiresAt ?? null],
  );
}

// ── Private sellers ────────────────────────────────────────

export interface PrivateSeller {
  id: string;
  userId: string;
  phone: string;
  location: string;
  verified: boolean;
  createdAt: string;
  userName?: string | null;
  userEmail?: string | null;
}

export async function createPrivateSeller(data: {
  userId: string;
  phone: string;
  location: string;
}): Promise<PrivateSeller> {
  const rows = await query<PrivateSeller>(
    `INSERT INTO private_sellers (user_id, phone, location)
     VALUES ($1, $2, $3)
     RETURNING id, user_id AS "userId", phone, location, verified,
               created_at AS "createdAt"`,
    [data.userId, data.phone, data.location],
  );
  if (!rows[0]) throw new Error("Private seller insert returned no rows");
  return rows[0];
}

export async function getPrivateSellerByUserId(userId: string): Promise<PrivateSeller | null> {
  const rows = await query<PrivateSeller>(
    `SELECT ps.id, ps.user_id AS "userId", ps.phone, ps.location,
            ps.verified, ps.created_at AS "createdAt",
            u.name AS "userName", u.email AS "userEmail"
     FROM private_sellers ps JOIN users u ON u.id = ps.user_id
     WHERE ps.user_id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

// ── Inquiries (contact requests per dealer/seller) ─────────

export interface Inquiry {
  id: string;
  carId: string | null;
  dealerId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  message: string;
  createdAt: string;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  carSlug?: string | null;
}

export async function getInquiriesForDealer(dealerId: string): Promise<Inquiry[]> {
  return query<Inquiry>(
    `SELECT cr.id, cr.car_id AS "carId", cr.dealer_id AS "dealerId",
            cr.buyer_name AS "buyerName", cr.buyer_email AS "buyerEmail",
            cr.buyer_phone AS "buyerPhone", cr.message,
            cr.created_at AS "createdAt",
            c.make AS "carMake", c.model AS "carModel",
            c.year AS "carYear", c.slug AS "carSlug"
     FROM contact_requests cr
     LEFT JOIN cars c ON c.id = cr.car_id
     WHERE cr.dealer_id = $1
     ORDER BY cr.created_at DESC`,
    [dealerId],
  );
}

export async function getInquiriesForSeller(userId: string): Promise<Inquiry[]> {
  return query<Inquiry>(
    `SELECT cr.id, cr.car_id AS "carId", cr.dealer_id AS "dealerId",
            cr.buyer_name AS "buyerName", cr.buyer_email AS "buyerEmail",
            cr.buyer_phone AS "buyerPhone", cr.message,
            cr.created_at AS "createdAt",
            c.make AS "carMake", c.model AS "carModel",
            c.year AS "carYear", c.slug AS "carSlug"
     FROM contact_requests cr
     LEFT JOIN cars c ON c.id = cr.car_id
     WHERE c.seller_user_id = $1
     ORDER BY cr.created_at DESC`,
    [userId],
  );
}

// ── Account health (moderation / strikes) ──────────────────
// Surfaced on the dashboards so sellers/dealers can see their standing.

export interface AccountHealth {
  isActive:         boolean;
  strikeCount:      number;
  lastStrikeAt:     string | null;
  suspendedAt:      string | null;
  suspensionReason: string | null;
}

export async function getDealerAccountHealth(dealerId: string): Promise<AccountHealth | null> {
  const rows = await query<AccountHealth>(
    `SELECT is_active AS "isActive", strike_count AS "strikeCount",
            last_strike_at AS "lastStrikeAt", suspended_at AS "suspendedAt",
            suspension_reason AS "suspensionReason"
     FROM dealers WHERE id = $1 LIMIT 1`,
    [dealerId],
  );
  return rows[0] ?? null;
}

export async function getSellerAccountHealth(userId: string): Promise<AccountHealth | null> {
  const rows = await query<AccountHealth>(
    `SELECT is_active AS "isActive", strike_count AS "strikeCount",
            last_strike_at AS "lastStrikeAt", suspended_at AS "suspendedAt",
            suspended_reason AS "suspensionReason"
     FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

// ── Car analytics per dealer ───────────────────────────────

export async function getDealerDailyViews(dealerId: string, days = 14) {
  return query<{ date: string; views: string }>(
    `SELECT DATE(cv.created_at)::TEXT AS date, COUNT(*)::TEXT AS views
     FROM car_views cv
     JOIN cars c ON c.id = cv.car_id
     WHERE c.dealer_id = $1
       AND cv.created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(cv.created_at)
     ORDER BY date ASC`,
    [dealerId],
  );
}

export async function getSellerCars(userId: string): Promise<DealerCar[]> {
  return query<DealerCar>(
    `SELECT c.id, c.dealer_id AS "dealerId", c.slug, c.year, c.make, c.model,
            c.trim, c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location, c.description,
            c.images, c.features, c.verified, c.status,
            c.is_featured AS "isFeatured",
            c.boost_expires_at AS "boostExpiresAt",
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COUNT(DISTINCT v.id)::INT  AS views,
            COUNT(DISTINCT cr.id)::INT AS inquiries
     FROM cars c
     LEFT JOIN car_views       v  ON v.car_id  = c.id
     LEFT JOIN contact_requests cr ON cr.car_id = c.id
     WHERE c.seller_user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [userId],
  );
}

export async function getSellerDailyViews(userId: string, days = 14) {
  return query<{ date: string; views: string }>(
    `SELECT DATE(cv.created_at)::TEXT AS date, COUNT(*)::TEXT AS views
     FROM car_views cv
     JOIN cars c ON c.id = cv.car_id
     WHERE c.seller_user_id = $1
       AND cv.created_at >= NOW() - INTERVAL '${days} days'
     GROUP BY DATE(cv.created_at)
     ORDER BY date ASC`,
    [userId],
  );
}

// ── Featured / boost ───────────────────────────────────────

export async function toggleFeatured(carId: string, dealerId: string, featured: boolean): Promise<void> {
  await query(
    `UPDATE cars SET is_featured = $1, updated_at = NOW()
     WHERE id = $2 AND dealer_id = $3`,
    [featured, carId, dealerId],
  );
}

export async function boostCar(carId: string, hours = 72): Promise<void> {
  await query(
    `UPDATE cars SET boost_expires_at = NOW() + INTERVAL '${hours} hours', updated_at = NOW()
     WHERE id = $1`,
    [carId],
  );
}

// ── News articles ─────────────────────────────────────────────────────────────

function mapNewsRow(r: Record<string, unknown>): NewsArticle {
  return {
    id:         r.id as string,
    title:      r.title as string,
    slug:       r.slug as string,
    source:     r.source as string,
    sourceUrl:  r.source_url as string,
    country:    r.country as string,
    category:   r.category as string,
    content:    (r.content as string | null) ?? null,
    summary:    (r.summary as string | null) ?? null,
    image:      (r.image as string | null) ?? null,
    url:        r.url as string,
    urlHash:    r.url_hash as string,
    titleHash:  r.title_hash as string,
    publishedAt: r.published_at as string,
    tags:       (r.tags as string[]) ?? [],
    status:     r.status as NewsArticle["status"],
    featured:   Boolean(r.featured),
    viewCount:  Number(r.view_count ?? 0),
    impactScore:  (r.impact_score as NewsArticle["impactScore"]) ?? null,
    kenyaSummary: (r.kenya_summary as NewsArticle["kenyaSummary"]) ?? null,
    createdAt:  r.created_at as string,
  };
}

export interface GetNewsOptions {
  category?: string;
  country?: string;
  status?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export async function getNewsArticles(opts: GetNewsOptions = {}): Promise<NewsArticle[]> {
  const {
    category, country, status = "published",
    featured, limit = 20, offset = 0, search,
  } = opts;

  const conditions = ["status = $1"];
  const params: unknown[] = [status];
  let idx = 2;

  if (category && category !== "all") {
    conditions.push(`category = $${idx++}`);
    params.push(category);
  }
  if (country && country !== "all") {
    conditions.push(`country = $${idx++}`);
    params.push(country);
  }
  if (featured) {
    conditions.push("featured = TRUE");
  }
  if (search) {
    conditions.push(`(title ILIKE $${idx} OR summary ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  params.push(limit, offset);

  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM news_articles
     WHERE ${conditions.join(" AND ")}
     ORDER BY published_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params,
  );
  return rows.map(mapNewsRow);
}

export async function getNewsArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM news_articles WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapNewsRow(rows[0]) : null;
}

export async function getRelatedNewsArticles(
  category: string,
  excludeId: string,
  limit = 4,
): Promise<NewsArticle[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM news_articles
     WHERE category = $1 AND id != $2 AND status = 'published'
     ORDER BY published_at DESC LIMIT $3`,
    [category, excludeId, limit],
  );
  return rows.map(mapNewsRow);
}

export async function incrementNewsViewCount(id: string): Promise<void> {
  await query(
    `UPDATE news_articles SET view_count = view_count + 1 WHERE id = $1`,
    [id],
  );
}

export async function isNewsUrlKnown(urlHash: string, titleHash: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM news_articles WHERE url_hash = $1 OR title_hash = $2
     ) AS exists`,
    [urlHash, titleHash],
  );
  return rows[0]?.exists ?? false;
}

export async function updateNewsArticleStatus(
  id: string,
  status: "published" | "pending" | "rejected",
): Promise<void> {
  await query(
    `UPDATE news_articles SET status = $1 WHERE id = $2`,
    [status, id],
  );
}

export async function toggleNewsArticleFeatured(id: string, featured: boolean): Promise<void> {
  await query(
    `UPDATE news_articles SET featured = $1 WHERE id = $2`,
    [featured, id],
  );
}

export async function deleteNewsArticle(id: string): Promise<void> {
  await query(`DELETE FROM news_articles WHERE id = $1`, [id]);
}

export async function getNewsCount(status?: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM news_articles${status ? ` WHERE status = '${status}'` : ""}`,
    [],
  );
  return Number(rows[0]?.count ?? 0);
}

// PR1 News Intelligence: finds listings on Agnora related to a news article.
// Strategy: case-insensitive substring match of the article title against
// cars.make. If two cars share a make we pick the most recent. Uses the
// public visibility helper so hidden / archived / unqualified listings
// never surface in editorial context.
//
// Falls back to empty array on no match — the UI hides the strip entirely
// rather than showing irrelevant inventory.
export async function getRelatedCarsForArticle(opts: {
  title: string;
  body?: string | null;
  limit?: number;
}): Promise<Car[]> {
  const { title, body = "", limit = 4 } = opts;
  const haystack = `${title} ${body ?? ""}`.toLowerCase();

  // Pull the canonical makes table once; match against article text.
  const makeRows = await query<{ name: string }>(
    `SELECT DISTINCT make AS name FROM cars WHERE make IS NOT NULL`,
    [],
  );
  const hits = makeRows
    .map((r) => r.name)
    .filter((m) => haystack.includes(m.toLowerCase()));

  if (!hits.length) return [];

  const rows = await query<Car>(
    `SELECT c.id, c.slug, c.year, c.make, c.model, c.trim, c.price,
            c.mileage, c.fuel, c.transmission, c.body_type AS "bodyType",
            c.condition, c.location, c.images, c.features, c.verified,
            c.is_featured AS "isFeatured",
            c.created_at AS "createdAt"
     FROM cars c
     WHERE c.make = ANY($1)
       AND ${buildPublicListingVisibilityWhere("c")}
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [hits, limit],
  );
  return rows;
}

// ── Research articles ─────────────────────────────────────────────────────────

function mapResearchRow(r: Record<string, unknown>): ResearchArticle {
  return {
    id:             r.id as string,
    title:          r.title as string,
    slug:           r.slug as string,
    category:       r.category as ResearchArticle["category"],
    content:        r.content as string,
    excerpt:        (r.excerpt as string | null) ?? null,
    author:         r.author as string,
    seoTitle:       (r.seo_title as string | null) ?? null,
    seoDescription: (r.seo_description as string | null) ?? null,
    featuredImage:  (r.featured_image as string | null) ?? null,
    tags:           (r.tags as string[]) ?? [],
    status:         r.status as ResearchArticle["status"],
    featured:       Boolean(r.featured),
    viewCount:      Number(r.view_count ?? 0),
    sponsored:      Boolean(r.sponsored),
    sponsorName:    (r.sponsor_name as string | null) ?? null,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  };
}

export async function getResearchArticles(
  opts: { category?: string; status?: string; limit?: number; offset?: number } = {},
): Promise<ResearchArticle[]> {
  const { category, status = "published", limit = 20, offset = 0 } = opts;
  const conditions = ["status = $1"];
  const params: unknown[] = [status];
  let idx = 2;

  if (category && category !== "all") {
    conditions.push(`category = $${idx++}`);
    params.push(category);
  }
  params.push(limit, offset);

  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM research_articles
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params,
  );
  return rows.map(mapResearchRow);
}

export async function getResearchArticleBySlug(slug: string): Promise<ResearchArticle | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM research_articles WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapResearchRow(rows[0]) : null;
}

export async function createResearchArticle(
  data: Omit<ResearchArticle, "id" | "viewCount" | "createdAt" | "updatedAt">,
): Promise<ResearchArticle> {
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO research_articles
       (title, slug, category, content, excerpt, author,
        seo_title, seo_description, featured_image,
        tags, status, featured, sponsored, sponsor_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.title, data.slug, data.category, data.content,
      data.excerpt, data.author, data.seoTitle, data.seoDescription,
      data.featuredImage, data.tags, data.status, data.featured,
      data.sponsored, data.sponsorName,
    ],
  );
  return mapResearchRow(rows[0]);
}

export async function updateResearchArticle(
  id: string,
  data: Partial<Omit<ResearchArticle, "id" | "createdAt">>,
): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const colMap: Record<string, string> = {
    title: "title", slug: "slug", category: "category", content: "content",
    excerpt: "excerpt", author: "author", seoTitle: "seo_title",
    seoDescription: "seo_description", featuredImage: "featured_image",
    tags: "tags", status: "status", featured: "featured",
    sponsored: "sponsored", sponsorName: "sponsor_name",
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (key in data) {
      fields.push(`${col} = $${idx++}`);
      params.push((data as Record<string, unknown>)[key]);
    }
  }
  if (fields.length === 0) return;

  fields.push(`updated_at = NOW()`);
  params.push(id);

  await query(
    `UPDATE research_articles SET ${fields.join(", ")} WHERE id = $${idx}`,
    params,
  );
}

export async function deleteResearchArticle(id: string): Promise<void> {
  await query(`DELETE FROM research_articles WHERE id = $1`, [id]);
}

export async function incrementResearchViewCount(id: string): Promise<void> {
  await query(
    `UPDATE research_articles SET view_count = view_count + 1 WHERE id = $1`,
    [id],
  );
}

// ── Phone OTPs ─────────────────────────────────────────────────────────────

export interface PhoneOtp {
  id: string;
  userId: string;
  phone: string;
  code: string;
  expiresAt: string;
  verified: boolean;
  attempts: number;
  createdAt: string;
}

export async function upsertPhoneOtp(userId: string, phone: string, code: string): Promise<void> {
  // Keep old records for rate-limit counting; verifyPhoneOtp always picks the newest.
  // Purge records older than 1 hour to prevent table bloat.
  await query(`DELETE FROM phone_otps WHERE user_id = $1 AND created_at < NOW() - INTERVAL '1 hour'`, [userId]);
  await query(
    `INSERT INTO phone_otps (user_id, phone, code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [userId, phone, code],
  );
}

/** Count OTP send requests for a user in the last hour (for rate limiting). */
export async function countRecentOtpRequests(userId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM phone_otps
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId],
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function verifyPhoneOtp(
  userId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const rows = await query<PhoneOtp>(
    `SELECT id, code, expires_at AS "expiresAt", verified, attempts
     FROM phone_otps WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const otp = rows[0];
  if (!otp)                              return { ok: false, error: "No code found. Request a new one." };
  if (otp.verified)                      return { ok: false, error: "Code already used." };
  if (new Date(otp.expiresAt) < new Date()) return { ok: false, error: "Code expired. Request a new one." };
  if (otp.attempts >= 5)                 return { ok: false, error: "Too many attempts. Request a new code." };

  if (otp.code !== code) {
    await query(`UPDATE phone_otps SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
    return { ok: false, error: "Invalid code." };
  }
  await query(`UPDATE phone_otps SET verified = TRUE WHERE id = $1`, [otp.id]);
  return { ok: true };
}

// ── Seller verifications ───────────────────────────────────────────────────

export interface SellerVerification {
  id: string;
  userId: string;
  phone: string | null;
  phoneVerified: boolean;
  idDocUrl: string | null;
  kraCertUrl: string | null;
  logbookUrl: string | null;
  selfieUrl: string | null;
  businessCertUrl: string | null;
  status: "pending" | "submitted" | "approved" | "rejected";
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string | null;
  userEmail?: string | null;
}

const SV_COLS = `
  sv.id, sv.user_id AS "userId", sv.phone, sv.phone_verified AS "phoneVerified",
  sv.id_doc_url AS "idDocUrl", sv.kra_cert_url AS "kraCertUrl",
  sv.logbook_url AS "logbookUrl", sv.selfie_url AS "selfieUrl",
  sv.business_cert_url AS "businessCertUrl", sv.status,
  sv.admin_notes AS "adminNotes", sv.reviewed_by AS "reviewedBy",
  sv.reviewed_at AS "reviewedAt", sv.submitted_at AS "submittedAt",
  sv.created_at AS "createdAt", sv.updated_at AS "updatedAt",
  u.name AS "userName", u.email AS "userEmail"`;

export async function getOrCreateSellerVerification(userId: string): Promise<SellerVerification> {
  const rows = await query<SellerVerification>(
    `SELECT ${SV_COLS} FROM seller_verifications sv
     JOIN users u ON u.id = sv.user_id
     WHERE sv.user_id = $1 LIMIT 1`,
    [userId],
  );
  if (rows[0]) return rows[0];
  await query(`INSERT INTO seller_verifications (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
  const created = await query<SellerVerification>(
    `SELECT ${SV_COLS} FROM seller_verifications sv
     JOIN users u ON u.id = sv.user_id
     WHERE sv.user_id = $1 LIMIT 1`,
    [userId],
  );
  return created[0];
}

export async function patchSellerVerification(
  userId: string,
  fields: {
    phone?: string;
    phoneVerified?: boolean;
    idDocUrl?: string;
    kraCertUrl?: string;
    logbookUrl?: string;
    selfieUrl?: string;
    businessCertUrl?: string;
  },
): Promise<void> {
  const colMap: Record<string, string> = {
    phone:           "phone",
    phoneVerified:   "phone_verified",
    idDocUrl:        "id_doc_url",
    kraCertUrl:      "kra_cert_url",
    logbookUrl:      "logbook_url",
    selfieUrl:       "selfie_url",
    businessCertUrl: "business_cert_url",
  };
  const sets = ["updated_at = NOW()"];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(colMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = $${i++}`);
      vals.push(fields[key as keyof typeof fields]);
    }
  }
  if (sets.length === 1) return; // nothing to update
  vals.push(userId);
  await query(
    `UPDATE seller_verifications SET ${sets.join(", ")} WHERE user_id = $${i}`,
    vals,
  );
}

export async function submitSellerVerification(userId: string): Promise<void> {
  await query(
    `UPDATE seller_verifications
     SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  );
}

export async function listSellerVerifications(status?: string): Promise<SellerVerification[]> {
  const hasFilter = status && status !== "all";
  return query<SellerVerification>(
    `SELECT ${SV_COLS} FROM seller_verifications sv
     JOIN users u ON u.id = sv.user_id
     ${hasFilter ? "WHERE sv.status = $1" : ""}
     ORDER BY (sv.status = 'submitted')::int DESC,
              sv.submitted_at DESC NULLS LAST,
              sv.created_at DESC`,
    hasFilter ? [status] : [],
  );
}

export async function getSellerVerificationCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*) AS n FROM seller_verifications GROUP BY status`,
  );
  const out: Record<string, number> = { all: 0 };
  for (const r of rows) {
    out[r.status] = Number(r.n);
    out.all += Number(r.n);
  }
  return out;
}

export async function reviewSellerVerification(
  id: string,
  status: "approved" | "rejected",
  adminId: string,
  adminNotes?: string,
): Promise<void> {
  await query(
    `UPDATE seller_verifications
     SET status = $1, admin_notes = $2, reviewed_by = $3,
         reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [status, adminNotes ?? null, adminId, id],
  );
  if (status === "approved") {
    const rows = await query<{ userId: string }>(
      `SELECT user_id AS "userId" FROM seller_verifications WHERE id = $1`,
      [id],
    );
    if (rows[0]) {
      await query(
        `UPDATE private_sellers SET verified = TRUE WHERE user_id = $1`,
        [rows[0].userId],
      );
    }
  }
}

// ── User active status ─────────────────────────────────────────────────────

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await query(
    `UPDATE users SET is_active = $1 WHERE id = $2`,
    [isActive, userId],
  );
}

// PR2: manual admin suspend/unsuspend with reason. Stamps suspended_at on
// suspend, clears it on unsuspend so support can answer "when was this
// done". When unsuspending, also resets strike_count so the actor isn't
// instantly re-suspended by the next strike inside the rolling window.
export async function setUserSuspension(
  userId: string,
  isActive: boolean,
  reason: string | null,
): Promise<void> {
  if (isActive) {
    await query(
      `UPDATE users
       SET is_active = TRUE,
           suspended_at = NULL,
           suspended_reason = NULL,
           strike_count = 0
       WHERE id = $1`,
      [userId],
    );
  } else {
    await query(
      `UPDATE users
       SET is_active = FALSE,
           suspended_at = NOW(),
           suspended_reason = $1
       WHERE id = $2`,
      [reason, userId],
    );
  }
}

export async function setDealerSuspension(
  dealerId: string,
  isActive: boolean,
  reason: string | null,
): Promise<void> {
  if (isActive) {
    await query(
      `UPDATE dealers
       SET is_active = TRUE,
           suspended_at = NULL,
           suspension_reason = NULL,
           strike_count = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [dealerId],
    );
  } else {
    await query(
      `UPDATE dealers
       SET is_active = FALSE,
           suspended_at = NOW(),
           suspension_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reason, dealerId],
    );
  }
}

export async function touchLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_login = NOW() WHERE id = $1`,
    [userId],
  ).catch(() => {/* non-fatal — column may not exist yet */});
}

// ── Admin activity audit log ───────────────────────────────────────────────

export interface AdminLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function logAdminAction(data: {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO admin_logs
       (admin_id, admin_email, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.adminId,
      data.adminEmail,
      data.action,
      data.targetType,
      data.targetId,
      JSON.stringify(data.details ?? {}),
    ],
  ).catch((err) => {
    // Table may not exist yet — fail silently rather than breaking admin actions
    console.error("[admin-log] insert failed:", (err as Error).message);
  });
}

export async function getAdminLogs(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  adminId?: string;
} = {}): Promise<AdminLog[]> {
  const { limit = 50, offset = 0, action, adminId } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (action) { conditions.push(`action = $${idx++}`); params.push(action); }
  if (adminId) { conditions.push(`admin_id = $${idx++}`); params.push(adminId); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const rows = await query<Record<string, unknown>>(
    `SELECT id, admin_id AS "adminId", admin_email AS "adminEmail",
            action, target_type AS "targetType", target_id AS "targetId",
            details, created_at AS "createdAt"
     FROM admin_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params,
  );

  return rows.map((r) => ({
    id:          r.id as string,
    adminId:     r.adminId as string,
    adminEmail:  r.adminEmail as string,
    action:      r.action as string,
    targetType:  r.targetType as string,
    targetId:    r.targetId as string,
    details:     (r.details as Record<string, unknown>) ?? {},
    createdAt:   r.createdAt as string,
  }));
}

export async function getAdminLogCount(opts: {
  action?: string;
  adminId?: string;
} = {}): Promise<number> {
  const { action, adminId } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (action) { conditions.push(`action = $${idx++}`); params.push(action); }
  if (adminId) { conditions.push(`admin_id = $${idx++}`); params.push(adminId); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM admin_logs ${where}`,
    params,
  );
  return Number(rows[0]?.count ?? 0);
}

// ── Analytics — revenue ────────────────────────────────────────────────────

export async function getTotalRevenue(): Promise<number> {
  const rows = await query<{ revenue: string }>(
    `SELECT COALESCE(SUM(price), 0)::TEXT AS revenue FROM cars WHERE status = 'sold'`,
  );
  return Number(rows[0]?.revenue ?? 0);
}

export async function getRevenueByMonth(months = 6): Promise<{ month: string; revenue: number }[]> {
  const rows = await query<{ month: string; revenue: string }>(
    `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COALESCE(SUM(price), 0)::TEXT AS revenue
     FROM cars
     WHERE status = 'sold'
       AND created_at >= NOW() - ($1::INT * INTERVAL '1 month')
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month ASC`,
    [months],
  );
  return rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));
}

// ── Analytics — users ──────────────────────────────────────────────────────

export async function getUserGrowthByMonth(months = 6): Promise<{ month: string; count: number }[]> {
  const rows = await query<{ month: string; count: string }>(
    `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*)::TEXT AS count
     FROM users
     WHERE created_at >= NOW() - ($1::INT * INTERVAL '1 month')
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month ASC`,
    [months],
  );
  return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
}

// ── Analytics — listings ───────────────────────────────────────────────────

export async function getListingStatusBreakdown(): Promise<{ status: string; count: number }[]> {
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::TEXT AS count FROM cars GROUP BY status ORDER BY count::INT DESC`,
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

export interface AdminListingRow {
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  status: string;
  location: string;
  createdAt: string;
  views: number;
  dealerName: string | null;
}

export async function getAdminListingsTable(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminListingRow[]> {
  const { status, limit = 50, offset = 0 } = opts;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const rows = await query<Record<string, unknown>>(
    `SELECT c.id, c.year, c.make, c.model, c.price::BIGINT AS price, c.status,
            c.location, c.created_at AS "createdAt",
            COALESCE(COUNT(v.id), 0)::INT AS views,
            d.business_name AS "dealerName"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     LEFT JOIN car_views v ON v.car_id = c.id
     ${where}
     GROUP BY c.id, d.business_name
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params,
  );

  return rows.map((r) => ({
    id:         r.id as string,
    year:       r.year as number,
    make:       r.make as string,
    model:      r.model as string,
    price:      Number(r.price),
    status:     r.status as string,
    location:   r.location as string,
    createdAt:  r.createdAt as string,
    views:      r.views as number,
    dealerName: (r.dealerName as string | null) ?? null,
  }));
}

// ── Analytics — dealers ────────────────────────────────────────────────────

export interface DealerActivity {
  dealerId: string;
  businessName: string;
  location: string;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  revenue: number;
}

// ── Analytics events (PR8) ───────────────────────────────────────────────────

export interface AnalyticsEventRow {
  id:          string;
  name:        string;
  props:       Record<string, unknown>;
  path:        string | null;
  sessionHash: string | null;
  userId:      string | null;
  createdAt:   string;
}

export async function insertAnalyticsEvent(data: {
  name:        string;
  props:       Record<string, unknown>;
  path?:       string | null;
  ipHash?:     string | null;
  sessionHash?: string | null;
  userId?:     string | null;
}): Promise<void> {
  await query(
    `INSERT INTO analytics_events (name, props, path, ip_hash, session_hash, user_id)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6)`,
    [
      data.name,
      JSON.stringify(data.props ?? {}),
      data.path        ?? null,
      data.ipHash      ?? null,
      data.sessionHash ?? null,
      data.userId      ?? null,
    ],
  );
}

export interface EventTotal { name: string; total: number; sessions: number }

export async function getAnalyticsEventTotals(sinceDays = 7, limit = 12): Promise<EventTotal[]> {
  const rows = await query<EventTotal>(
    `SELECT name,
            COUNT(*)::INT                                AS total,
            COUNT(DISTINCT session_hash)::INT             AS sessions
     FROM analytics_events
     WHERE created_at >= NOW() - ($1::int || ' days')::interval
     GROUP BY name
     ORDER BY total DESC
     LIMIT $2`,
    [sinceDays, limit],
  );
  return rows;
}

export interface TopSearchTerm { q: string; count: number }

export async function getTopSearchTerms(sinceDays = 7, limit = 10): Promise<TopSearchTerm[]> {
  // q is stored on search_submitted events as props->>'q'.
  const rows = await query<TopSearchTerm>(
    `SELECT (props->>'q')::text  AS q,
            COUNT(*)::INT          AS count
     FROM analytics_events
     WHERE name = 'search_submitted'
       AND created_at >= NOW() - ($1::int || ' days')::interval
       AND COALESCE(props->>'q','') <> ''
     GROUP BY q
     ORDER BY count DESC
     LIMIT $2`,
    [sinceDays, limit],
  );
  return rows;
}

export async function getTopDealersByActivity(limit = 10): Promise<DealerActivity[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT d.id                                        AS "dealerId",
            d.business_name                             AS "businessName",
            d.location,
            COUNT(c.id)::INT                            AS "totalListings",
            COUNT(CASE WHEN c.status='active' THEN 1 END)::INT AS "activeListings",
            COUNT(CASE WHEN c.status='sold'   THEN 1 END)::INT AS "soldListings",
            COALESCE(SUM(CASE WHEN c.status='sold' THEN c.price ELSE 0 END),0)::BIGINT AS revenue
     FROM dealers d
     LEFT JOIN cars c ON c.dealer_id = d.id
     WHERE d.status = 'approved'
     GROUP BY d.id, d.business_name, d.location
     ORDER BY "totalListings" DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    dealerId:      r.dealerId as string,
    businessName:  r.businessName as string,
    location:      r.location as string,
    totalListings: r.totalListings as number,
    activeListings: r.activeListings as number,
    soldListings:  r.soldListings as number,
    revenue:       Number(r.revenue),
  }));
}

// ── Makes & Models (vehicle taxonomy) ───────────────────────────────────────

export async function listMakes(): Promise<Make[]> {
  return query<Make>(
    `SELECT id, slug, name FROM makes ORDER BY name ASC`,
  );
}

export async function getMakeBySlug(slug: string): Promise<Make | null> {
  const rows = await query<Make>(
    `SELECT id, slug, name FROM makes WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function listModelsByMakeSlug(slug: string): Promise<Model[]> {
  return query<Model>(
    `SELECT mo.id, mo.make_id AS "makeId", mo.slug, mo.name
     FROM models mo
     JOIN makes ma ON ma.id = mo.make_id
     WHERE ma.slug = $1
     ORDER BY mo.name ASC`,
    [slug],
  );
}

export async function listModelsByMakeId(makeId: string): Promise<Model[]> {
  return query<Model>(
    `SELECT id, make_id AS "makeId", slug, name
     FROM models
     WHERE make_id = $1
     ORDER BY name ASC`,
    [makeId],
  );
}

// Cross-make model lookup for autocomplete (PR3b).
export async function searchModels(q: string, limit = 5): Promise<(Model & { makeName: string; makeSlug: string })[]> {
  return query<Model & { makeName: string; makeSlug: string }>(
    `SELECT mo.id, mo.make_id AS "makeId", mo.slug, mo.name,
            ma.name AS "makeName", ma.slug AS "makeSlug"
     FROM models mo
     JOIN makes ma ON ma.id = mo.make_id
     WHERE mo.name ILIKE $1
     ORDER BY mo.name ASC
     LIMIT $2`,
    [`%${q}%`, limit],
  );
}

export async function searchDealers(
  q: string, limit = 3,
): Promise<{ id: string; businessName: string; location: string }[]> {
  return query<{ id: string; businessName: string; location: string }>(
    `SELECT id, business_name AS "businessName", location
     FROM dealers
     WHERE status = 'approved'
       AND business_name ILIKE $1
     ORDER BY business_name ASC
     LIMIT $2`,
    [`%${q}%`, limit],
  );
}

// ── Batch lookup by ID (PR3d) ───────────────────────────────────────────────
// Used for wishlist and recently-viewed — both store car IDs in localStorage
// and need to resolve them to full Car records. Comparing as TEXT avoids the
// UUID-cast pitfall when the input contains static demo IDs ("1", "2") that
// were committed to a user's localStorage during dev. Order is NOT preserved
// here — the caller restores it.
export async function getCarsByIds(ids: string[]): Promise<Car[]> {
  if (!ids.length) return [];

  type Row = {
    id: string; slug: string; year: number; make: string; model: string;
    trim: string | null; price: number | string; mileage: number; fuel: string;
    transmission: string; bodyType: string; condition: string; location: string;
    description: string; images: string[]; features: string[]; verified: boolean;
    financingAvailable: boolean; hirePurchaseAvailable: boolean;
    isFeatured: boolean | null;
    drivetrain: string | null; engineSizeL: number | string | null;
    previousOwners: number | null; exteriorColor: string | null;
    interiorColor: string | null; sellerType: string | null;
    mileageVerified: boolean | null; logbookVerified: boolean | null;
    accidentHistory: string | null;
    specifications: Record<string, unknown> | null;
    createdAt: string;
    dealerName: string | null; dealerLocation: string | null; dealerPhone: string | null;
  };

  const rows = await query<Row>(
    `SELECT c.id, c.slug, c.year, c.make, c.model, c.trim,
            c.price, c.mileage, c.fuel, c.transmission,
            c.body_type        AS "bodyType",
            c.condition, c.location, c.description, c.images, c.features,
            c.verified,
            c.financing_available     AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.is_featured             AS "isFeatured",
            c.drivetrain,
            c.engine_size_l    AS "engineSizeL",
            c.previous_owners  AS "previousOwners",
            c.exterior_color   AS "exteriorColor",
            c.interior_color   AS "interiorColor",
            c.seller_type      AS "sellerType",
            c.mileage_verified AS "mileageVerified",
            c.logbook_verified AS "logbookVerified",
            c.accident_history AS "accidentHistory",
            c.specifications,
            c.created_at       AS "createdAt",
            COALESCE(d.business_name, c.seller_name) AS "dealerName",
            COALESCE(d.location, c.location)         AS "dealerLocation",
            COALESCE(d.phone, c.seller_phone)        AS "dealerPhone"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     WHERE c.id::text = ANY($1::text[])`,
    // Visibility filter is intentionally OMITTED here. Wishlist and
    // recently-viewed must resolve any saved car — even one that has since
    // been hidden by the quality policy — so the buyer can still see what
    // they previously saved. See visibility matrix in the project spec.
    [ids],
  );

  return rows.map((r) => ({
    id: r.id, slug: r.slug, year: r.year, make: r.make, model: r.model,
    trim: r.trim ?? undefined,
    price: Number(r.price),
    mileage: r.mileage,
    fuel: r.fuel as Car["fuel"],
    transmission: r.transmission as Car["transmission"],
    bodyType: r.bodyType as Car["bodyType"],
    condition: r.condition as Car["condition"],
    location: r.location,
    description: r.description,
    images: r.images?.length ? r.images : ["/placeholder-car.jpg"],
    features: r.features ?? [],
    verified: r.verified,
    isFeatured: r.isFeatured ?? false,
    financingAvailable:    r.financingAvailable,
    hirePurchaseAvailable: r.hirePurchaseAvailable,
    drivetrain:     (r.drivetrain    ?? undefined) as Car["drivetrain"],
    engineSizeL:    r.engineSizeL    !== null ? Number(r.engineSizeL) : undefined,
    previousOwners: r.previousOwners ?? undefined,
    exteriorColor:  r.exteriorColor  ?? undefined,
    interiorColor:  r.interiorColor  ?? undefined,
    sellerType:     (r.sellerType    ?? undefined) as Car["sellerType"],
    mileageVerified:         r.mileageVerified         ?? undefined,
    logbookVerified:         r.logbookVerified         ?? undefined,
    accidentHistory:         (r.accidentHistory ?? undefined) as Car["accidentHistory"],
    specifications: mergeSpecifications(r.specifications, {
      drivetrain:     r.drivetrain,
      exteriorColor:  r.exteriorColor,
      interiorColor:  r.interiorColor,
      previousOwners: r.previousOwners,
    }),
    createdAt: r.createdAt,
    dealer: {
      name:     r.dealerName     ?? "Agnora Dealer",
      rating:   0,
      reviews:  0,
      location: r.dealerLocation ?? "",
      phone:    r.dealerPhone    ?? "",
    },
  }));
}

// Buyer-facing read merges typed columns (drivetrain, exteriorColor,
// interiorColor, previousOwners) into the JSONB specifications object so
// consumers see ONE unified Specifications shape regardless of where each
// value is physically stored. Stripping undefined leaves keeps the object
// compact + predictable.
function mergeSpecifications(
  jsonb: Record<string, unknown> | null | undefined,
  typed: {
    drivetrain:     string | null;
    exteriorColor:  string | null;
    interiorColor:  string | null;
    previousOwners: number | null;
  },
): Car["specifications"] {
  const merged: Record<string, unknown> = {
    ...(jsonb ?? {}),
    drivetrain:     typed.drivetrain     ?? (jsonb as Record<string, unknown> | null)?.drivetrain,
    exteriorColor:  typed.exteriorColor  ?? (jsonb as Record<string, unknown> | null)?.exteriorColor,
    interiorColor:  typed.interiorColor  ?? (jsonb as Record<string, unknown> | null)?.interiorColor,
    previousOwners: typed.previousOwners ?? (jsonb as Record<string, unknown> | null)?.previousOwners,
  };
  const clean = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v != null && v !== ""),
  );
  return Object.keys(clean).length > 0 ? (clean as Car["specifications"]) : undefined;
}

// ── Public detail lookup ────────────────────────────────────────────────────
// Single source of truth for the public detail page. Uses the visibility
// helper so it matches /cars search exactly — anything visible in search is
// reachable here, anything hidden returns null.
//
// In development only: when the lookup returns null, we run a tiny diagnostic
// query against the same slug (no visibility filter) and log why the listing
// was hidden. Never exposed in production.
export async function getCarBySlug(slug: string): Promise<Car | null> {
  type Row = {
    id: string; slug: string; year: number; make: string; model: string;
    trim: string | null; price: number | string; mileage: number; fuel: string;
    transmission: string; bodyType: string; condition: string; location: string;
    description: string; images: string[]; features: string[]; verified: boolean;
    financingAvailable: boolean; hirePurchaseAvailable: boolean;
    isFeatured: boolean | null;
    drivetrain: string | null; engineSizeL: number | string | null;
    previousOwners: number | null; exteriorColor: string | null;
    interiorColor: string | null; sellerType: string | null;
    vin: string | null; vinVerified: boolean;
    serviceHistoryAvailable: boolean; ownershipVerified: boolean; inspectionAvailable: boolean;
    mileageVerified: boolean; logbookVerified: boolean; accidentHistory: string | null;
    specifications: Record<string, unknown> | null;
    createdAt: string;
    dealerName: string | null; dealerLocation: string | null; dealerPhone: string | null;
  };

  const rows = await query<Row>(
    `SELECT c.id, c.slug, c.year, c.make, c.model, c.trim,
            c.price, c.mileage, c.fuel, c.transmission,
            c.body_type        AS "bodyType",
            c.condition, c.location, c.description, c.images, c.features,
            c.verified,
            c.financing_available     AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.is_featured             AS "isFeatured",
            c.drivetrain,
            c.engine_size_l    AS "engineSizeL",
            c.previous_owners  AS "previousOwners",
            c.exterior_color   AS "exteriorColor",
            c.interior_color   AS "interiorColor",
            c.seller_type      AS "sellerType",
            c.vin,
            c.vin_verified                AS "vinVerified",
            c.service_history_available   AS "serviceHistoryAvailable",
            c.ownership_verified          AS "ownershipVerified",
            c.inspection_available        AS "inspectionAvailable",
            c.mileage_verified            AS "mileageVerified",
            c.logbook_verified            AS "logbookVerified",
            c.accident_history            AS "accidentHistory",
            c.specifications,
            c.created_at       AS "createdAt",
            COALESCE(d.business_name, c.seller_name) AS "dealerName",
            COALESCE(d.location, c.location)         AS "dealerLocation",
            COALESCE(d.phone, c.seller_phone)        AS "dealerPhone"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     WHERE c.slug = $1
       AND ${buildPublicListingVisibilityWhere("c")}
     LIMIT 1`,
    [slug],
  );

  if (rows.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      await logHiddenDetailMiss(slug);
    }
    return null;
  }

  const r = rows[0];
  return {
    id: r.id, slug: r.slug, year: r.year, make: r.make, model: r.model,
    trim: r.trim ?? undefined,
    price: Number(r.price),
    mileage: r.mileage,
    fuel: r.fuel as Car["fuel"],
    transmission: r.transmission as Car["transmission"],
    bodyType: r.bodyType as Car["bodyType"],
    condition: r.condition as Car["condition"],
    location: r.location,
    description: r.description,
    images: r.images?.length ? r.images : ["/placeholder-car.jpg"],
    features: r.features ?? [],
    verified: r.verified,
    isFeatured: r.isFeatured ?? false,
    financingAvailable:    r.financingAvailable,
    hirePurchaseAvailable: r.hirePurchaseAvailable,
    drivetrain:     (r.drivetrain     ?? undefined) as Car["drivetrain"],
    engineSizeL:    r.engineSizeL    != null ? Number(r.engineSizeL) : undefined,
    previousOwners: r.previousOwners ?? undefined,
    exteriorColor:  r.exteriorColor  ?? undefined,
    interiorColor:  r.interiorColor  ?? undefined,
    sellerType:     (r.sellerType    ?? undefined) as Car["sellerType"],
    vin:                     r.vin ?? undefined,
    vinVerified:             r.vinVerified,
    serviceHistoryAvailable: r.serviceHistoryAvailable,
    ownershipVerified:       r.ownershipVerified,
    inspectionAvailable:     r.inspectionAvailable,
    mileageVerified:         r.mileageVerified,
    logbookVerified:         r.logbookVerified,
    accidentHistory:         (r.accidentHistory ?? undefined) as Car["accidentHistory"],
    specifications:          mergeSpecifications(r.specifications, {
      drivetrain:     r.drivetrain,
      exteriorColor:  r.exteriorColor,
      interiorColor:  r.interiorColor,
      previousOwners: r.previousOwners,
    }),
    createdAt: r.createdAt,
    dealer: {
      name:     r.dealerName     ?? "Agnora Dealer",
      rating:   0,
      reviews:  0,
      location: r.dealerLocation ?? "",
      phone:    r.dealerPhone    ?? "",
    },
  };
}

// Dev-only: explains WHY a slug came back null from getCarBySlug. Probes the
// underlying row (no visibility filter) and re-evaluates the policy bits so
// the developer can see at a glance whether the issue was status, photo
// count, missing VIN, or simply that the slug doesn't exist.
async function logHiddenDetailMiss(slug: string): Promise<void> {
  try {
    const rows = await query<{
      slug: string; status: string; createdAt: string;
      photoCount: number; vinLength: number;
    }>(
      `SELECT slug, status,
              created_at::text                              AS "createdAt",
              COALESCE(array_length(images, 1), 0)::INT     AS "photoCount",
              COALESCE(LENGTH(vin), 0)::INT                 AS "vinLength"
       FROM cars WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if (rows.length === 0) {
      console.log(`[getCarBySlug] slug=%s not found in cars table`, slug);
      return;
    }
    const r = rows[0];
    const grandfathered = r.createdAt < QUALITY_POLICY_CUTOFF;
    const meetsBar      = r.photoCount >= MIN_PUBLISH_PHOTOS && r.vinLength >= MIN_VIN_LEN;
    const isActive      = r.status === "active";
    const wouldBeVisible = isActive && (grandfathered || meetsBar);
    console.log(
      `[getCarBySlug] HIDDEN slug=%s status=%s createdAt=%s photos=%d vinLen=%d ` +
      `grandfathered=%s meetsBar=%s isActive=%s -> visible=%s`,
      slug, r.status, r.createdAt, r.photoCount, r.vinLength,
      grandfathered, meetsBar, isActive, wouldBeVisible,
    );
  } catch (err) {
    console.warn("[getCarBySlug] diagnostic probe failed:", err instanceof Error ? err.message : err);
  }
}

// ── Cars search (PR2 of the search redesign) ────────────────────────────────
// Server-side filtering + faceted aggregation. Replaces the client-side filter
// in components/cars-listing.tsx. Universal text search covers make, model,
// trim, description, location, body type, fuel, transmission, and the
// dealer/seller name. Multi-value filters accept both display names and
// slugs (case-insensitive, hyphen-normalized) so the UI cascade from PR1
// can submit either form during the data-migration transition.
//
// PR3c: facet counts use *independent* aggregation — for each facet dimension,
// every filter EXCEPT that dimension is applied. So picking Toyota in Makes
// no longer collapses the Makes facet to "Toyota (N)"; the other makes still
// show their counts.

type FacetDim =
  | "make" | "model" | "body" | "fuel" | "condition" | "transmission" | "location"
  | "drivetrain" | "exterior_color" | "seller_type";

function pushIn(
  col: string,
  values: string[],
  conditions: string[],
  params: unknown[],
  idx: { v: number },
  slugify: boolean,
): void {
  const lowered = values.map((v) => v.toLowerCase());
  const i = idx.v++;
  if (slugify) {
    conditions.push(`LOWER(REPLACE(${col}, ' ', '-')) = ANY($${i}::text[])`);
  } else {
    conditions.push(`LOWER(${col}) = ANY($${i}::text[])`);
  }
  params.push(lowered);
}

/**
 * Build the SQL WHERE clause + parameter array for a search.
 * When `exclude` is set, that dimension's multi-value filter is dropped so
 * the resulting query can be used to compute an "independent" facet count.
 */
function buildSearchWhere(
  filters: SearchFilters,
  exclude?: FacetDim,
): { whereSql: string; params: unknown[] } {
  // Single source of truth for public visibility: status + grandfather +
  // photo/VIN bar. Anything beyond visibility is a user-facing filter and
  // lives below.
  const conditions: string[] = [buildPublicListingVisibilityWhere("c")];
  const params: unknown[]   = [];
  const idx                  = { v: 1 };

  if (filters.q) {
    const i = idx.v++;
    conditions.push(`(
      c.make            ILIKE $${i} OR
      c.model           ILIKE $${i} OR
      COALESCE(c.trim, '') ILIKE $${i} OR
      c.description     ILIKE $${i} OR
      c.location        ILIKE $${i} OR
      c.body_type       ILIKE $${i} OR
      c.fuel            ILIKE $${i} OR
      c.transmission    ILIKE $${i} OR
      COALESCE(c.seller_name, '')      ILIKE $${i} OR
      COALESCE(d.business_name, '')    ILIKE $${i}
    )`);
    params.push(`%${filters.q}%`);
  }

  if (exclude !== "make"           && filters.makes?.length)          pushIn("c.make",          filters.makes,          conditions, params, idx, true);
  if (exclude !== "model"          && filters.models?.length)         pushIn("c.model",         filters.models,         conditions, params, idx, true);
  if (exclude !== "body"           && filters.bodyTypes?.length)      pushIn("c.body_type",     filters.bodyTypes,      conditions, params, idx, false);
  if (exclude !== "fuel"           && filters.fuels?.length)          pushIn("c.fuel",          filters.fuels,          conditions, params, idx, false);
  if (exclude !== "condition"      && filters.conditions?.length)     pushIn("c.condition",     filters.conditions,     conditions, params, idx, false);
  if (exclude !== "transmission"   && filters.transmissions?.length)  pushIn("c.transmission",  filters.transmissions,  conditions, params, idx, false);
  if (exclude !== "location"       && filters.locations?.length)      pushIn("c.location",      filters.locations,      conditions, params, idx, false);
  if (exclude !== "drivetrain"     && filters.drivetrains?.length)    pushIn("c.drivetrain",    filters.drivetrains,    conditions, params, idx, false);
  if (exclude !== "exterior_color" && filters.exteriorColors?.length) pushIn("c.exterior_color",filters.exteriorColors, conditions, params, idx, false);
  if (exclude !== "seller_type"    && filters.sellerTypes?.length)    pushIn("c.seller_type",   filters.sellerTypes,    conditions, params, idx, false);
  if (filters.interiorColors?.length) pushIn("c.interior_color", filters.interiorColors, conditions, params, idx, false);

  if (filters.minPrice      !== undefined) { const i = idx.v++; conditions.push(`c.price          >= $${i}`); params.push(filters.minPrice); }
  if (filters.maxPrice      !== undefined) { const i = idx.v++; conditions.push(`c.price          <= $${i}`); params.push(filters.maxPrice); }
  if (filters.minYear       !== undefined) { const i = idx.v++; conditions.push(`c.year           >= $${i}`); params.push(filters.minYear); }
  if (filters.maxYear       !== undefined) { const i = idx.v++; conditions.push(`c.year           <= $${i}`); params.push(filters.maxYear); }
  if (filters.minMileage    !== undefined) { const i = idx.v++; conditions.push(`c.mileage        >= $${i}`); params.push(filters.minMileage); }
  if (filters.maxMileage    !== undefined) { const i = idx.v++; conditions.push(`c.mileage        <= $${i}`); params.push(filters.maxMileage); }
  if (filters.minEngineSize !== undefined) { const i = idx.v++; conditions.push(`c.engine_size_l  >= $${i}`); params.push(filters.minEngineSize); }
  if (filters.maxEngineSize !== undefined) { const i = idx.v++; conditions.push(`c.engine_size_l  <= $${i}`); params.push(filters.maxEngineSize); }
  if (filters.maxOwners     !== undefined) { const i = idx.v++; conditions.push(`c.previous_owners <= $${i}`); params.push(filters.maxOwners); }

  if (filters.financing)      conditions.push("c.financing_available         = TRUE");
  if (filters.hirePurchase)   conditions.push("c.hire_purchase_available     = TRUE");
  if (filters.verifiedOnly)   conditions.push("c.verified                    = TRUE");
  if (filters.trustInspection) conditions.push("c.inspection_available        = TRUE");
  if (filters.trustService)    conditions.push("c.service_history_available   = TRUE");
  if (filters.trustOwnership)  conditions.push("c.ownership_verified          = TRUE");
  if (filters.trustVin)        conditions.push("c.vin_verified                = TRUE");
  // 2026-06-22 trust fields.
  if (filters.trustMileageVerified) conditions.push("c.mileage_verified            = TRUE");
  if (filters.trustLogbookVerified) conditions.push("c.logbook_verified            = TRUE");
  if (filters.accidentHistories?.length) {
    const i = idx.v++;
    conditions.push(`c.accident_history = ANY($${i}::text[])`);
    params.push(filters.accidentHistories);
  }
  // PR6: trustBelowMarket is NOT added here — it requires per-query handling
  // (LATERAL join in results, correlated subquery in total). Facet queries
  // intentionally skip it to keep aggregation cost bounded.

  // PR5: radius haversine. Applies only when one location is chosen and
  // radius > 0. Skipped when computing the location facet (the centre would
  // be the filter we're trying to ignore).
  if (
    exclude !== "location" &&
    filters.radiusKm && filters.radiusKm > 0 &&
    filters.locations?.length === 1
  ) {
    const centroid = getCentroid(filters.locations[0]);
    if (centroid) {
      const iLat = idx.v++;
      const iLng = idx.v++;
      const iKm  = idx.v++;
      conditions.push(
        `c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND ` +
        `(6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($${iLat})) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians($${iLng}))
              + sin(radians($${iLat})) * sin(radians(c.latitude))
            ))
        )) <= $${iKm}`,
      );
      params.push(centroid.lat, centroid.lng, filters.radiusKm);
    }
  }

  return { whereSql: conditions.join(" AND "), params };
}

export async function searchCarsDb(filters: SearchFilters): Promise<SearchResponse> {
  // Expand Kenya-market aliases so free-text "benz" still finds Mercedes-Benz
  // cars even though they're stored as "Mercedes-Benz" in cars.make.
  const effective: SearchFilters = filters.q
    ? { ...filters, q: expandAliases(filters.q).expanded }
    : filters;

  const base   = buildSearchWhere(effective);
  const facetW = {
    make:           buildSearchWhere(effective, "make"),
    body:           buildSearchWhere(effective, "body"),
    fuel:           buildSearchWhere(effective, "fuel"),
    condition:      buildSearchWhere(effective, "condition"),
    transmission:   buildSearchWhere(effective, "transmission"),
    location:       buildSearchWhere(effective, "location"),
    drivetrain:     buildSearchWhere(effective, "drivetrain"),
    exteriorColor:  buildSearchWhere(effective, "exterior_color"),
    sellerType:     buildSearchWhere(effective, "seller_type"),
  };

  const limit  = effective.limit ?? 20;
  const page   = effective.page  ?? 1;
  const offset = (page - 1) * limit;

  const orderBy = (() => {
    switch (effective.sort) {
      case "price_asc":   return "c.price ASC, c.created_at DESC";
      case "price_desc":  return "c.price DESC, c.created_at DESC";
      case "mileage_asc": return "c.mileage ASC, c.created_at DESC";
      case "year_desc":   return "c.year DESC, c.created_at DESC";
      case "featured":    return "c.is_featured DESC NULLS LAST, c.created_at DESC";
      case "newest":
      default:            return "c.created_at DESC";
    }
  })();

  // PR6: market-price classification thresholds (mirror constants in lib/search.ts).
  const GREAT_DEAL_THRESHOLD   = 0.92;
  const ABOVE_MARKET_THRESHOLD = 1.08;
  const MIN_COMPARABLES        = 3;
  const trustBM = effective.trustBelowMarket;

  // Correlated subquery for trustBelowMarket — used in total query.
  // Returns NULL when fewer than MIN_COMPARABLES comparables exist, which
  // makes `c.price <= NULL` evaluate to NULL → row excluded.
  const belowMarketCorrSql = trustBM ? `
    AND c.price <= (
      SELECT AVG(c2.price) * ${GREAT_DEAL_THRESHOLD}
      FROM cars c2
      WHERE c2.make = c.make AND c2.model = c.model
        AND ABS(c2.year - c.year) <= 1
        AND c2.id != c.id
        AND c2.status = 'active'
      HAVING COUNT(*) >= ${MIN_COMPARABLES}
    )` : "";

  // Results query: all filters applied, paginated. LATERAL join computes
  // marketAvg + sample_count once per result row (cheap with make+model index).
  const resultsSql = `
    SELECT c.id, c.slug, c.year, c.make, c.model, c.trim,
           c.price, c.mileage, c.fuel, c.transmission,
           c.body_type        AS "bodyType",
           c.condition, c.location, c.description, c.images, c.features,
           c.verified,
           c.financing_available     AS "financingAvailable",
           c.hire_purchase_available AS "hirePurchaseAvailable",
           c.is_featured             AS "isFeatured",
           c.drivetrain,
           c.engine_size_l    AS "engineSizeL",
           c.previous_owners  AS "previousOwners",
           c.exterior_color   AS "exteriorColor",
           c.interior_color   AS "interiorColor",
           c.seller_type      AS "sellerType",
           c.vin_verified              AS "vinVerified",
           c.service_history_available AS "serviceHistoryAvailable",
           c.ownership_verified        AS "ownershipVerified",
           c.inspection_available      AS "inspectionAvailable",
           c.mileage_verified          AS "mileageVerified",
           c.logbook_verified          AS "logbookVerified",
           c.accident_history          AS "accidentHistory",
           sim.avg_price              AS "marketAvg",
           sim.sample_count           AS "marketSampleCount",
           CASE
             WHEN sim.avg_price IS NULL OR sim.sample_count < ${MIN_COMPARABLES} THEN NULL
             WHEN c.price <= sim.avg_price * ${GREAT_DEAL_THRESHOLD}   THEN 'great'
             WHEN c.price >= sim.avg_price * ${ABOVE_MARKET_THRESHOLD} THEN 'above'
             ELSE 'fair'
           END AS "priceTier",
           c.created_at       AS "createdAt",
           COALESCE(d.business_name, c.seller_name) AS "dealerName",
           COALESCE(d.location, c.location)         AS "dealerLocation",
           COALESCE(d.phone, c.seller_phone)        AS "dealerPhone"
    FROM cars c
    LEFT JOIN dealers d ON d.id = c.dealer_id
    LEFT JOIN LATERAL (
      SELECT AVG(c2.price)::NUMERIC AS avg_price, COUNT(*)::INT AS sample_count
      FROM cars c2
      WHERE c2.make = c.make AND c2.model = c.model
        AND ABS(c2.year - c.year) <= 1
        AND c2.id != c.id
        AND c2.status = 'active'
    ) sim ON TRUE
    WHERE ${base.whereSql}
      ${trustBM ? `AND sim.sample_count >= ${MIN_COMPARABLES} AND c.price <= sim.avg_price * ${GREAT_DEAL_THRESHOLD}` : ""}
    ORDER BY ${orderBy}
    LIMIT $${base.params.length + 1} OFFSET $${base.params.length + 2}
  `;

  // Total count: same WHERE as results, plus trustBelowMarket correlated subquery.
  const totalSql = `
    SELECT COUNT(*)::INT AS count
    FROM cars c LEFT JOIN dealers d ON d.id = c.dealer_id
    WHERE ${base.whereSql}
      ${belowMarketCorrSql}
  `;

  // Per-facet aggregation queries — each excludes its own dimension's filter.
  // Every facet column lives on `cars`, so qualify with `c.` to avoid the
  // `location` column being ambiguous against `dealers.location` (the JOIN
  // makes both visible to the planner).
  const facetSql = (col: string, whereSql: string) => `
    SELECT c.${col} AS value, COUNT(*)::INT AS count
    FROM cars c LEFT JOIN dealers d ON d.id = c.dealer_id
    WHERE ${whereSql}
    GROUP BY c.${col}
  `;

  type ResultRow = {
    id: string; slug: string; year: number; make: string; model: string;
    trim: string | null; price: number | string; mileage: number; fuel: string;
    transmission: string; bodyType: string; condition: string; location: string;
    description: string; images: string[]; features: string[]; verified: boolean;
    financingAvailable: boolean; hirePurchaseAvailable: boolean;
    isFeatured: boolean | null;
    drivetrain: string | null; engineSizeL: number | string | null;
    previousOwners: number | null; exteriorColor: string | null;
    interiorColor: string | null; sellerType: string | null;
    vinVerified: boolean | null; serviceHistoryAvailable: boolean | null;
    ownershipVerified: boolean | null; inspectionAvailable: boolean | null;
    mileageVerified: boolean | null; logbookVerified: boolean | null;
    accidentHistory: string | null;
    marketAvg: number | string | null; marketSampleCount: number | null;
    priceTier: string | null;
    createdAt: string;
    dealerName: string | null; dealerLocation: string | null; dealerPhone: string | null;
  };
  type FacetRow = { value: string; count: number };

  const [
    rows, totalRows,
    makesRows, bodyRows, fuelRows, conditionRows, locationRows, transmissionRows,
    drivetrainRows, exteriorColorRows, sellerTypeRows,
  ] = await Promise.all([
    query<ResultRow>(resultsSql, [...base.params, limit, offset]),
    query<{ count: number }>(totalSql,                                       base.params),
    query<FacetRow>(facetSql("make",           facetW.make.whereSql),           facetW.make.params),
    query<FacetRow>(facetSql("body_type",      facetW.body.whereSql),           facetW.body.params),
    query<FacetRow>(facetSql("fuel",           facetW.fuel.whereSql),           facetW.fuel.params),
    query<FacetRow>(facetSql("condition",      facetW.condition.whereSql),      facetW.condition.params),
    query<FacetRow>(facetSql("location",       facetW.location.whereSql),       facetW.location.params),
    query<FacetRow>(facetSql("transmission",   facetW.transmission.whereSql),   facetW.transmission.params),
    query<FacetRow>(facetSql("drivetrain",     facetW.drivetrain.whereSql),     facetW.drivetrain.params),
    query<FacetRow>(facetSql("exterior_color", facetW.exteriorColor.whereSql),  facetW.exteriorColor.params),
    query<FacetRow>(facetSql("seller_type",    facetW.sellerType.whereSql),     facetW.sellerType.params),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const sorter = (buckets: FacetBucket[]) => buckets.sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
  const toBuckets = (rows: FacetRow[]): FacetBucket[] => {
    const buckets = rows
      .filter((r) => r.value != null && r.value !== "")
      .map((r) => ({ value: r.value, count: r.count }));
    sorter(buckets);
    return buckets;
  };

  const facets: SearchFacets = {
    makes:          toBuckets(makesRows),
    bodyTypes:      toBuckets(bodyRows),
    fuels:          toBuckets(fuelRows),
    conditions:     toBuckets(conditionRows),
    locations:      toBuckets(locationRows),
    transmissions:  toBuckets(transmissionRows),
    drivetrains:    toBuckets(drivetrainRows),
    exteriorColors: toBuckets(exteriorColorRows),
    sellerTypes:    toBuckets(sellerTypeRows),
  };

  const cars: Car[] = rows.map((r) => ({
    id: r.id, slug: r.slug, year: r.year, make: r.make, model: r.model,
    trim: r.trim ?? undefined,
    price: Number(r.price),
    mileage: r.mileage,
    fuel: r.fuel as Car["fuel"],
    transmission: r.transmission as Car["transmission"],
    bodyType: r.bodyType as Car["bodyType"],
    condition: r.condition as Car["condition"],
    location: r.location,
    description: r.description,
    images: r.images?.length ? r.images : ["/placeholder-car.jpg"],
    features: r.features ?? [],
    verified: r.verified,
    isFeatured: r.isFeatured ?? false,
    financingAvailable:    r.financingAvailable,
    hirePurchaseAvailable: r.hirePurchaseAvailable,
    drivetrain:     (r.drivetrain    ?? undefined) as Car["drivetrain"],
    engineSizeL:    r.engineSizeL    !== null ? Number(r.engineSizeL) : undefined,
    previousOwners: r.previousOwners ?? undefined,
    exteriorColor:  r.exteriorColor  ?? undefined,
    interiorColor:  r.interiorColor  ?? undefined,
    sellerType:     (r.sellerType    ?? undefined) as Car["sellerType"],
    vinVerified:             r.vinVerified             ?? undefined,
    serviceHistoryAvailable: r.serviceHistoryAvailable ?? undefined,
    ownershipVerified:       r.ownershipVerified       ?? undefined,
    inspectionAvailable:     r.inspectionAvailable     ?? undefined,
    mileageVerified:         r.mileageVerified         ?? undefined,
    logbookVerified:         r.logbookVerified         ?? undefined,
    accidentHistory:         (r.accidentHistory ?? undefined) as Car["accidentHistory"],
    marketAvg:               r.marketAvg         !== null ? Math.round(Number(r.marketAvg)) : undefined,
    marketSampleCount:       r.marketSampleCount ?? undefined,
    priceTier:               (r.priceTier ?? undefined) as Car["priceTier"],
    createdAt: r.createdAt,
    dealer: {
      name:     r.dealerName     ?? "Agnora Dealer",
      rating:   0,
      reviews:  0,
      location: r.dealerLocation ?? "",
      phone:    r.dealerPhone    ?? "",
    },
  }));

  return {
    cars,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    facets,
    source: "db",
  };
}
