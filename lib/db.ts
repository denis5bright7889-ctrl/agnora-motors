import { neon } from "@neondatabase/serverless";
import type { Car, Dealer, DealerCar, User } from "@/types";

// neon() uses HTTP (fetch) transport — works on Node.js 18 and Edge runtimes
// without needing a WebSocket polyfill. Each call is a stateless HTTP request.
let _sql: ReturnType<typeof neon> | null = null;

function getSql(): ReturnType<typeof neon> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. " +
      "Add it to Vercel → Settings → Environment Variables.",
    );
  }
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sql = getSql();
  // neon() called as sql(text, paramsArray) returns rows directly (T[])
  const rows = await (sql as unknown as (t: string, p: unknown[]) => Promise<T[]>)(
    text,
    params,
  );
  return rows;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Users ──────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await query<User>(
    `SELECT id, name, email, image, role, created_at AS "createdAt"
     FROM users WHERE email = $1 LIMIT 1`,
    [email],
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
): Promise<(User & { passwordHash: string | null }) | null> {
  const rows = await query<User & { passwordHash: string | null }>(
    `SELECT id, name, email, image, role,
            password_hash AS "passwordHash",
            created_at   AS "createdAt"
     FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash?: string;
  role?: string;
  image?: string;
}): Promise<User> {
  const rows = await query<User>(
    `INSERT INTO users (email, name, password_hash, role, image)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, image, role, created_at AS "createdAt"`,
    [
      data.email,
      data.name,
      data.passwordHash ?? null,
      data.role ?? "buyer",
      data.image ?? null,
    ],
  );
  if (!rows[0]) throw new Error("User insert returned no rows");
  return rows[0];
}

export async function listUsers(): Promise<User[]> {
  return query<User>(
    `SELECT id, name, email, image, role, created_at AS "createdAt"
     FROM users ORDER BY created_at DESC`,
  );
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
}): Promise<Dealer> {
  const rows = await query<Dealer>(
    `INSERT INTO dealers
       (user_id, business_name, business_reg, kra_pin, director_name,
        director_id_url, business_cert_url, phone, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
      data.phone, data.location,
    ],
  );
  return rows[0];
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
  return query<Dealer>(
    `SELECT d.id, d.user_id AS "userId", d.business_name AS "businessName",
            d.business_reg AS "businessReg", d.kra_pin AS "kraPin",
            d.director_name AS "directorName", d.director_id_url AS "directorIdUrl",
            d.business_cert_url AS "businessCertUrl", d.phone, d.location,
            d.status, d.rejection_reason AS "rejectionReason",
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

  const rows = await query<DealerCar>(
    `INSERT INTO cars
       (dealer_id, slug, year, make, model, trim, price, mileage, fuel,
        transmission, body_type, condition, location, description, images, features,
        financing_available, hire_purchase_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING
       id, dealer_id AS "dealerId", slug, year, make, model, trim,
       price, mileage, fuel, transmission,
       body_type AS "bodyType", condition, location, description,
       images, features, verified, status,
       financing_available  AS "financingAvailable",
       hire_purchase_available AS "hirePurchaseAvailable",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      dealerId, slug, data.year, data.make, data.model, data.trim ?? null,
      data.price, data.mileage, data.fuel, data.transmission, data.bodyType,
      data.condition, data.location, data.description,
      data.images, data.features,
      data.financingAvailable  ?? false,
      data.hirePurchaseAvailable ?? false,
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

export async function getAllDbCars(): Promise<DealerCar[]> {
  return query<DealerCar>(
    `SELECT c.id, c.dealer_id AS "dealerId", c.slug, c.year, c.make,
            c.model, c.trim, c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location, c.description,
            c.images, c.features, c.verified, c.status,
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COUNT(DISTINCT v.id)::INT AS views
     FROM cars c
     LEFT JOIN car_views v ON v.car_id = c.id
     WHERE c.status = 'active'
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
} = {}): Promise<Car[]> {
  const conditions: string[] = ["c.status = 'active'"];
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
  };

  const rows = await query<Row>(
    `SELECT c.id, c.slug, c.year, c.make, c.model, c.trim,
            c.price, c.mileage, c.fuel, c.transmission,
            c.body_type AS "bodyType", c.condition, c.location,
            c.description, c.images, c.features, c.verified,
            c.financing_available  AS "financingAvailable",
            c.hire_purchase_available AS "hirePurchaseAvailable",
            c.created_at AS "createdAt",
            d.business_name AS "dealerName",
            d.location      AS "dealerLocation",
            d.phone         AS "dealerPhone"
     FROM cars c
     LEFT JOIN dealers d ON d.id = c.dealer_id
     WHERE ${where}
     ORDER BY c.created_at DESC`,
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
      rating:   0,
      reviews:  0,
      location: r.dealerLocation ?? "",
      phone:    r.dealerPhone    ?? "",
    },
  }));
}

export async function updateDealerCar(
  id: string,
  dealerId: string,
  data: Partial<DealerCar>,
): Promise<void> {
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
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in data) {
      sets.push(`${col} = $${i++}`);
      vals.push((data as Record<string, unknown>)[key]);
    }
  }

  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  vals.push(id, dealerId);

  await query(
    `UPDATE cars SET ${sets.join(", ")} WHERE id = $${i} AND dealer_id = $${i + 1}`,
    vals,
  );
}

export async function deleteDealerCar(id: string, dealerId: string): Promise<void> {
  await query("DELETE FROM cars WHERE id = $1 AND dealer_id = $2", [id, dealerId]);
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
