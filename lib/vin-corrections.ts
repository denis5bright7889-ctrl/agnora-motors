import { query } from "@/lib/db";

// VIN learning loop. Sellers' edits to decoded fields are aggregated by VIN
// PREFIX (first 8 chars — WMI+VDS, shared across many cars of the same
// model/engine) and applied to future decodes only after an admin approves
// the pattern. We never store the full VIN for learning.

export const VIN_PREFIX_LEN = 8;

// Fields worth learning. Year/make come reliably from WMI/NHTSA, so we don't
// learn those — we focus on the ones decoders commonly get wrong for imports.
export const CORRECTABLE_FIELDS = [
  "engineCc", "transmission", "fuel", "bodyType", "model", "trim", "drivetrain",
] as const;
export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

// Patterns seen this many times are surfaced to admins as "ready to review".
export const REVIEW_THRESHOLD = 5;

export function vinPrefix(vin: string): string {
  return (vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, VIN_PREFIX_LEN);
}

export function isCorrectableField(v: unknown): v is CorrectableField {
  return typeof v === "string" && (CORRECTABLE_FIELDS as readonly string[]).includes(v);
}

export interface CorrectionPattern {
  id: string;
  vinPrefix: string;
  field: string;
  value: string;
  timesSeen: number;
  status: string;
  updatedAt: string;
}

// Record (or increment) a seller correction. Idempotent per (prefix, field,
// value): the same correction from many sellers raises times_seen, which is
// the learning signal.
export async function recordCorrection(
  prefix: string, field: CorrectableField, value: string,
): Promise<void> {
  if (!prefix || prefix.length < VIN_PREFIX_LEN) return;
  const v = String(value).slice(0, 120);
  if (!v) return;
  await query(
    `INSERT INTO vin_corrections (vin_prefix, field, value, times_seen)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (vin_prefix, field, value)
     DO UPDATE SET times_seen = vin_corrections.times_seen + 1,
                   updated_at = NOW(),
                   -- a rejected pattern that keeps recurring goes back to pending
                   status = CASE WHEN vin_corrections.status = 'rejected' THEN 'pending'
                                 ELSE vin_corrections.status END`,
    [prefix, field, v],
  );
}

// Approved corrections for a prefix — the most-seen approved value per field.
export async function getApprovedCorrections(prefix: string): Promise<Partial<Record<CorrectableField, string>>> {
  if (!prefix || prefix.length < VIN_PREFIX_LEN) return {};
  const rows = await query<{ field: string; value: string }>(
    `SELECT DISTINCT ON (field) field, value
     FROM vin_corrections
     WHERE vin_prefix = $1 AND status = 'approved'
     ORDER BY field, times_seen DESC`,
    [prefix],
  );
  const out: Partial<Record<CorrectableField, string>> = {};
  for (const r of rows) {
    if (isCorrectableField(r.field)) out[r.field] = r.value;
  }
  return out;
}

// ── Admin ────────────────────────────────────────────────────

export async function listCorrectionPatterns(status = "pending", limit = 200): Promise<CorrectionPattern[]> {
  return query<CorrectionPattern>(
    `SELECT id, vin_prefix AS "vinPrefix", field, value, times_seen AS "timesSeen",
            status, updated_at AS "updatedAt"
     FROM vin_corrections
     WHERE status = $1
     ORDER BY times_seen DESC, updated_at DESC
     LIMIT $2`,
    [status, limit],
  );
}

export async function setCorrectionStatus(
  id: string, status: "approved" | "rejected" | "pending",
): Promise<void> {
  await query(`UPDATE vin_corrections SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
}

export interface VinQualityStats {
  totalPatterns: number;
  pending: number;
  approved: number;
  readyForReview: number;          // pending with times_seen >= REVIEW_THRESHOLD
  topCorrectedFields: { field: string; count: number }[];
}

export async function getVinQualityStats(): Promise<VinQualityStats> {
  const [counts, ready, byField] = await Promise.all([
    query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::TEXT AS n FROM vin_corrections GROUP BY status`,
    ),
    query<{ n: string }>(
      `SELECT COUNT(*)::TEXT AS n FROM vin_corrections WHERE status = 'pending' AND times_seen >= $1`,
      [REVIEW_THRESHOLD],
    ),
    query<{ field: string; n: string }>(
      `SELECT field, COUNT(*)::TEXT AS n FROM vin_corrections GROUP BY field ORDER BY COUNT(*) DESC LIMIT 6`,
    ),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
  const total = counts.reduce((s, c) => s + Number(c.n), 0);
  return {
    totalPatterns: total,
    pending: byStatus["pending"] ?? 0,
    approved: byStatus["approved"] ?? 0,
    readyForReview: Number(ready[0]?.n ?? 0),
    topCorrectedFields: byField.map((b) => ({ field: b.field, count: Number(b.n) })),
  };
}
