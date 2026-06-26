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

// Executive decode-quality metrics for /admin/health, from the vin_decode_*
// analytics events + the corrections table. Includes 30d-vs-prior-30d trends
// so the operator can watch the learning loop drive correction rates down.
export interface VinDecodeQuality {
  totalDecodes: number;
  decodeSuccessRate: number | null;   // full decodes / total (0–1)
  partialRate: number | null;
  manualCorrectionRate: number | null;
  avgConfidence: number | null;       // 0–100
  evDecodes: number;
  evSuccessRate: number | null;
  learnedApplied: number;
  approvedPatterns: number;
  topCorrectedMakes: { make: string; count: number }[];
  successTrendPts: number | null;     // pct-point change vs prior 30d
  correctionTrendPts: number | null;
}

export async function getVinDecodeQuality(): Promise<VinDecodeQuality> {
  const [main, ratios, makes, trend] = await Promise.all([
    query<{
      total: string; full: string; partial: string; avgconf: string | null;
      ev: string; evfull: string; learned: string;
    }>(
      `SELECT COUNT(*)::TEXT AS total,
              COUNT(*) FILTER (WHERE props->>'decoded' = 'true')::TEXT AS full,
              COUNT(*) FILTER (WHERE props->>'partial' = 'true')::TEXT AS partial,
              AVG((props->>'overallConfidence')::numeric)
                FILTER (WHERE props ? 'overallConfidence')::TEXT AS avgconf,
              COUNT(*) FILTER (WHERE props->>'isEv' = 'true')::TEXT AS ev,
              COUNT(*) FILTER (WHERE props->>'isEv' = 'true' AND props->>'decoded' = 'true')::TEXT AS evfull,
              COUNT(*) FILTER (WHERE props->>'learned' = 'true')::TEXT AS learned
       FROM analytics_events WHERE name = 'vin_decode_succeeded'`,
    ),
    query<{ corrected: string; approved: string }>(
      `SELECT (SELECT COUNT(*) FROM analytics_events WHERE name = 'vin_decode_corrected')::TEXT AS corrected,
              (SELECT COUNT(*) FROM vin_corrections WHERE status = 'approved')::TEXT AS approved`,
    ),
    query<{ make: string; n: string }>(
      `SELECT props->>'make' AS make, COUNT(*)::TEXT AS n
       FROM analytics_events
       WHERE name = 'vin_decode_corrected' AND props->>'make' IS NOT NULL
       GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10`,
    ),
    query<{
      dec30: string; full30: string; decprev: string; fullprev: string;
      corr30: string; corrprev: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE name='vin_decode_succeeded' AND created_at >= NOW()-INTERVAL '30 days')::TEXT AS dec30,
         COUNT(*) FILTER (WHERE name='vin_decode_succeeded' AND props->>'decoded'='true' AND created_at >= NOW()-INTERVAL '30 days')::TEXT AS full30,
         COUNT(*) FILTER (WHERE name='vin_decode_succeeded' AND created_at >= NOW()-INTERVAL '60 days' AND created_at < NOW()-INTERVAL '30 days')::TEXT AS decprev,
         COUNT(*) FILTER (WHERE name='vin_decode_succeeded' AND props->>'decoded'='true' AND created_at >= NOW()-INTERVAL '60 days' AND created_at < NOW()-INTERVAL '30 days')::TEXT AS fullprev,
         COUNT(*) FILTER (WHERE name='vin_decode_corrected' AND created_at >= NOW()-INTERVAL '30 days')::TEXT AS corr30,
         COUNT(*) FILTER (WHERE name='vin_decode_corrected' AND created_at >= NOW()-INTERVAL '60 days' AND created_at < NOW()-INTERVAL '30 days')::TEXT AS corrprev
       FROM analytics_events WHERE name IN ('vin_decode_succeeded','vin_decode_corrected')`,
    ),
  ]);

  const m = main[0];
  const total = Number(m?.total ?? 0);
  const full = Number(m?.full ?? 0);
  const partial = Number(m?.partial ?? 0);
  const ev = Number(m?.ev ?? 0);
  const evFull = Number(m?.evfull ?? 0);
  const corrected = Number(ratios[0]?.corrected ?? 0);

  const rate = (num: number, den: number) => den > 0 ? num / den : null;

  // Trend = change in rate (percentage points) vs the prior 30-day window.
  const t = trend[0];
  const sr30 = rate(Number(t?.full30 ?? 0), Number(t?.dec30 ?? 0));
  const srPrev = rate(Number(t?.fullprev ?? 0), Number(t?.decprev ?? 0));
  const cr30 = rate(Number(t?.corr30 ?? 0), Number(t?.dec30 ?? 0));
  const crPrev = rate(Number(t?.corrprev ?? 0), Number(t?.decprev ?? 0));

  return {
    totalDecodes: total,
    decodeSuccessRate: rate(full, total),
    partialRate: rate(partial, total),
    manualCorrectionRate: rate(corrected, total),
    avgConfidence: m?.avgconf != null ? Number(m.avgconf) : null,
    evDecodes: ev,
    evSuccessRate: rate(evFull, ev),
    learnedApplied: Number(m?.learned ?? 0),
    approvedPatterns: Number(ratios[0]?.approved ?? 0),
    topCorrectedMakes: makes.map((x) => ({ make: x.make, count: Number(x.n) })),
    successTrendPts: sr30 !== null && srPrev !== null ? Math.round((sr30 - srPrev) * 100) : null,
    correctionTrendPts: cr30 !== null && crPrev !== null ? Math.round((cr30 - crPrev) * 100) : null,
  };
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
