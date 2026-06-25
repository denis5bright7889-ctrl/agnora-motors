import { query } from "@/lib/db";

// Trust layer: reviews + complaints. The human inputs into dealer reputation
// (the score wiring + public profile come in Phase 5). Nothing here auto-
// punishes — complaint outcomes are decided by people.

// ── Reviews ──────────────────────────────────────────────────

export interface Review {
  id: string;
  dealerId: string | null;
  carId: string | null;
  authorName: string;
  rating: number;
  communication: number | null;
  vehicleAccuracy: number | null;
  professionalism: number | null;
  wouldRecommend: boolean | null;
  body: string | null;
  purchaseVerified: boolean;
  createdAt: string;
}

export interface ReviewSummary {
  count: number;
  average: number;
  communication: number | null;
  vehicleAccuracy: number | null;
  professionalism: number | null;
  recommendPct: number | null;
  verifiedCount: number;
}

export interface CreateReviewInput {
  carId?: string | null;
  dealerId?: string | null;
  authorUserId?: string | null;
  authorName: string;
  rating: number;
  communication?: number | null;
  vehicleAccuracy?: number | null;
  professionalism?: number | null;
  wouldRecommend?: boolean | null;
  body?: string | null;
}

export type CreateReviewResult =
  | { ok: true; id: string; dealerId: string }
  | { ok: false; reason: "no_dealer" };

// Resolves the dealer (from explicit id or the car) and stores the review.
// Reviews require a dealer — a listing with no dealer can't be reputation-rated.
export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  let dealerId = input.dealerId ?? null;
  if (!dealerId && input.carId) {
    const rows = await query<{ dealerId: string | null }>(
      `SELECT dealer_id AS "dealerId" FROM cars WHERE id = $1 LIMIT 1`,
      [input.carId],
    );
    dealerId = rows[0]?.dealerId ?? null;
  }
  if (!dealerId) return { ok: false, reason: "no_dealer" };

  const clamp = (n: number | null | undefined) =>
    n == null ? null : Math.max(1, Math.min(5, Math.round(n)));

  const rows = await query<{ id: string }>(
    `INSERT INTO reviews
       (dealer_id, car_id, author_user_id, author_name, rating,
        communication, vehicle_accuracy, professionalism, would_recommend, body)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      dealerId, input.carId ?? null, input.authorUserId ?? null, input.authorName,
      clamp(input.rating) ?? 5,
      clamp(input.communication), clamp(input.vehicleAccuracy), clamp(input.professionalism),
      input.wouldRecommend ?? null, input.body ?? null,
    ],
  );
  return { ok: true, id: rows[0].id, dealerId };
}

export async function getDealerReviews(dealerId: string, limit = 50): Promise<Review[]> {
  return query<Review>(
    `SELECT id, dealer_id AS "dealerId", car_id AS "carId", author_name AS "authorName",
            rating, communication, vehicle_accuracy AS "vehicleAccuracy",
            professionalism, would_recommend AS "wouldRecommend", body,
            purchase_verified AS "purchaseVerified", created_at AS "createdAt"
     FROM reviews
     WHERE dealer_id = $1 AND status = 'published'
     ORDER BY created_at DESC
     LIMIT $2`,
    [dealerId, limit],
  );
}

export async function getDealerReviewSummary(dealerId: string): Promise<ReviewSummary> {
  const rows = await query<{
    count: string; average: string | null; communication: string | null;
    vehicleAccuracy: string | null; professionalism: string | null;
    recommendPct: string | null; verifiedCount: string;
  }>(
    `SELECT COUNT(*)::TEXT AS count,
            AVG(rating)::TEXT AS average,
            AVG(communication)::TEXT AS communication,
            AVG(vehicle_accuracy)::TEXT AS "vehicleAccuracy",
            AVG(professionalism)::TEXT AS professionalism,
            (AVG(CASE WHEN would_recommend IS TRUE THEN 1.0
                      WHEN would_recommend IS FALSE THEN 0.0 END) * 100)::TEXT AS "recommendPct",
            COUNT(*) FILTER (WHERE purchase_verified)::TEXT AS "verifiedCount"
     FROM reviews WHERE dealer_id = $1 AND status = 'published'`,
    [dealerId],
  );
  const r = rows[0];
  const num = (v: string | null) => (v == null ? null : Number(v));
  return {
    count: Number(r?.count ?? 0),
    average: r?.average ? Number(r.average) : 0,
    communication: num(r?.communication ?? null),
    vehicleAccuracy: num(r?.vehicleAccuracy ?? null),
    professionalism: num(r?.professionalism ?? null),
    recommendPct: num(r?.recommendPct ?? null),
    verifiedCount: Number(r?.verifiedCount ?? 0),
  };
}

// ── Complaints ───────────────────────────────────────────────

export const COMPLAINT_CATEGORIES = [
  "not_as_described", "unreachable", "suspected_fraud",
  "duplicate", "price_discrepancy", "other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  not_as_described:  "Vehicle not as described",
  unreachable:       "Dealer unreachable",
  suspected_fraud:   "Suspected fraud",
  duplicate:         "Duplicate listing",
  price_discrepancy: "Price discrepancy",
  other:             "Other",
};

export const COMPLAINT_STATUSES = ["submitted", "under_review", "resolved", "dismissed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export function isComplaintCategory(v: unknown): v is ComplaintCategory {
  return typeof v === "string" && (COMPLAINT_CATEGORIES as readonly string[]).includes(v);
}
export function isComplaintStatus(v: unknown): v is ComplaintStatus {
  return typeof v === "string" && (COMPLAINT_STATUSES as readonly string[]).includes(v);
}

export interface Complaint {
  id: string;
  dealerId: string | null;
  carId: string | null;
  reporterEmail: string | null;
  category: string;
  detail: string;
  status: ComplaintStatus;
  dealerResponse: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
}

export type CreateComplaintResult =
  | { ok: true; id: string; dealerId: string | null }
  | { ok: false; reason: "car_not_found" };

export async function createComplaint(input: {
  carId: string;
  reporterUserId?: string | null;
  reporterEmail?: string | null;
  category: ComplaintCategory;
  detail: string;
}): Promise<CreateComplaintResult> {
  const carRows = await query<{ dealerId: string | null }>(
    `SELECT dealer_id AS "dealerId" FROM cars WHERE id = $1 LIMIT 1`,
    [input.carId],
  );
  if (carRows.length === 0) return { ok: false, reason: "car_not_found" };
  const dealerId = carRows[0].dealerId;

  const rows = await query<{ id: string }>(
    `INSERT INTO complaints (dealer_id, car_id, reporter_user_id, reporter_email, category, detail)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [dealerId, input.carId, input.reporterUserId ?? null, input.reporterEmail ?? null, input.category, input.detail],
  );
  return { ok: true, id: rows[0].id, dealerId };
}

export async function getDealerComplaints(dealerId: string): Promise<Complaint[]> {
  return query<Complaint>(
    `SELECT cp.id, cp.dealer_id AS "dealerId", cp.car_id AS "carId",
            cp.reporter_email AS "reporterEmail", cp.category, cp.detail, cp.status,
            cp.dealer_response AS "dealerResponse", cp.resolution_note AS "resolutionNote",
            cp.created_at AS "createdAt", cp.updated_at AS "updatedAt",
            c.make AS "carMake", c.model AS "carModel", c.year AS "carYear"
     FROM complaints cp
     LEFT JOIN cars c ON c.id = cp.car_id
     WHERE cp.dealer_id = $1
     ORDER BY cp.created_at DESC`,
    [dealerId],
  );
}

export interface ComplaintStats {
  open: number;
  resolved: number;
  total: number;
  avgResolutionHours: number | null;
}

export async function getDealerComplaintStats(dealerId: string): Promise<ComplaintStats> {
  const rows = await query<{
    open: string; resolved: string; total: string; avgSecs: string | null;
  }>(
    `SELECT COUNT(*) FILTER (WHERE status IN ('submitted','under_review'))::TEXT AS open,
            COUNT(*) FILTER (WHERE status = 'resolved')::TEXT AS resolved,
            COUNT(*)::TEXT AS total,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
              FILTER (WHERE status IN ('resolved','dismissed'))::TEXT AS "avgSecs"
     FROM complaints WHERE dealer_id = $1`,
    [dealerId],
  );
  const r = rows[0];
  return {
    open: Number(r?.open ?? 0),
    resolved: Number(r?.resolved ?? 0),
    total: Number(r?.total ?? 0),
    avgResolutionHours: r?.avgSecs ? Number(r.avgSecs) / 3600 : null,
  };
}

// Dealer-side update: respond and/or move status. Final dismiss/uphold is an
// admin decision, but dealers can acknowledge (under_review) and mark resolved.
export async function updateComplaint(
  id: string, dealerId: string, patch: { status?: ComplaintStatus; dealerResponse?: string },
): Promise<Complaint | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.status !== undefined) { sets.push(`status = $${i++}`); vals.push(patch.status); }
  if (patch.dealerResponse !== undefined) { sets.push(`dealer_response = $${i++}`); vals.push(patch.dealerResponse); }
  if (sets.length === 0) return null;
  sets.push("updated_at = NOW()");
  vals.push(id, dealerId);

  await query(
    `UPDATE complaints SET ${sets.join(", ")} WHERE id = $${i} AND dealer_id = $${i + 1}`,
    vals,
  );
  const rows = await getDealerComplaints(dealerId);
  return rows.find((c) => c.id === id) ?? null;
}
