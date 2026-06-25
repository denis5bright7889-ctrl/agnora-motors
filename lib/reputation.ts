import { query, getDealerCars, getDealerAccountHealth } from "@/lib/db";
import { getDealerLeads } from "@/lib/leads";
import { getDealerReviewSummary, getDealerComplaintStats } from "@/lib/trust";
import {
  computeDealerScore, computeDealerBadges, explainDealerScore, MIN_PHOTOS,
  type Badge, type ScoreBand, type ScoreExplanation, type DealerScoreInput,
} from "@/lib/dealer-score";

// Single source of truth for a dealer's reputation — assembled from cars,
// leads, reviews and complaints. Used by the dealer home, the public profile
// and ranking so the score is identical everywhere.

export interface DealerReputation {
  score: number;
  band: ScoreBand;
  reviewConfidence: number;
  badges: Badge[];
  explanation: ScoreExplanation;
  metrics: {
    activeListings: number;
    totalListings: number;
    totalViews: number;
    totalLeads: number;
    responseRate: number | null;     // 0–1
    avgResponseHours: number | null;
    reviewCount: number;
    reviewAverage: number;
    recommendPct: number | null;
    openComplaints: number;
    resolvedComplaints: number;
    totalComplaints: number;
    strikeCount: number;
  };
}

export async function getDealerReputation(dealerId: string): Promise<DealerReputation> {
  const [statusRow, cars, leads, reviewSummary, complaintStats, health] = await Promise.all([
    query<{ status: string }>(`SELECT status FROM dealers WHERE id = $1`, [dealerId]),
    getDealerCars(dealerId),
    getDealerLeads(dealerId),
    getDealerReviewSummary(dealerId),
    getDealerComplaintStats(dealerId),
    getDealerAccountHealth(dealerId),
  ]);

  const verified = statusRow[0]?.status === "approved";
  const active = cars.filter((c) => c.status === "active");
  const listingsWithEnoughPhotos = active.filter((c) => (c.images?.length ?? 0) >= MIN_PHOTOS).length;
  const totalViews = cars.reduce((s, c) => s + (c.views ?? 0), 0);

  const totalLeads = leads.length;
  const respondedLeads = leads.filter((l) => l.status !== "new").length;
  const responded = leads.filter((l) => l.lastContactAt);
  const avgResponseHours = responded.length > 0
    ? responded.reduce((s, l) => s + (new Date(l.lastContactAt!).getTime() - new Date(l.createdAt).getTime()), 0)
        / responded.length / 3_600_000
    : null;

  const strikeCount = health?.strikeCount ?? 0;
  const totalComplaints = complaintStats.total;

  const scoreInput: DealerScoreInput = {
    verified,
    activeListings: active.length,
    listingsWithEnoughPhotos,
    totalViews,
    totalLeads,
    respondedLeads,
    reviewCount: reviewSummary.count,
    reviewAverage: reviewSummary.average,
    openComplaints: complaintStats.open,
    resolvedComplaints: complaintStats.resolved,
    strikeCount,
  };
  const detail = computeDealerScore(scoreInput);
  const explanation = explainDealerScore(scoreInput);

  const responseRate = totalLeads > 0 ? respondedLeads / totalLeads : null;

  const badges = computeDealerBadges({
    verified,
    score: detail.score,
    reviewCount: reviewSummary.count,
    reviewAverage: reviewSummary.average,
    recommendPct: reviewSummary.recommendPct,
    responseRate,
    avgResponseHours,
    totalLeads,
    totalComplaints,
    hasActivity: active.length > 0 || totalLeads > 0,
  });

  return {
    score: detail.score,
    band: detail.band,
    reviewConfidence: detail.reviewConfidence,
    badges,
    explanation,
    metrics: {
      activeListings: active.length,
      totalListings: cars.length,
      totalViews,
      totalLeads,
      responseRate,
      avgResponseHours,
      reviewCount: reviewSummary.count,
      reviewAverage: reviewSummary.average,
      recommendPct: reviewSummary.recommendPct,
      openComplaints: complaintStats.open,
      resolvedComplaints: complaintStats.resolved,
      totalComplaints,
      strikeCount,
    },
  };
}

// Recompute and cache the dealer's score on the dealers table so the public
// listing query can show trust signals cheaply. Best-effort — callers fire it
// after reputation-affecting events (review, complaint, lead, stage change).
export async function recomputeDealerScore(dealerId: string): Promise<void> {
  try {
    const rep = await getDealerReputation(dealerId);
    await query(
      `UPDATE dealers SET score = $1, score_updated_at = NOW() WHERE id = $2`,
      [rep.score, dealerId],
    );
    await recordDealerMilestones(dealerId, rep);
  } catch {
    /* non-fatal */
  }
}

// ── Trust timeline (historical milestones) ───────────────────

export interface Milestone {
  type: string;
  threshold: number;
  label: string;
  createdAt: string;
}

const ENQUIRY_TIERS = [10, 50, 100, 250, 500];
const REVIEW_TIERS = [5, 25, 50, 100];
const SCORE_TIERS: { at: number; label: string }[] = [
  { at: 80, label: "Earned Trusted Dealer" },
  { at: 85, label: "Reached Dealer Score 85" },
  { at: 90, label: "Reached Dealer Score 90" },
];

// Stamp any newly-crossed milestones. Idempotent via the unique index — a
// milestone keeps the timestamp of when it was FIRST recorded.
export async function recordDealerMilestones(
  dealerId: string, rep: DealerReputation,
): Promise<void> {
  const rows: { type: string; threshold: number; label: string }[] = [];
  for (const t of ENQUIRY_TIERS) {
    if (rep.metrics.totalLeads >= t) rows.push({ type: "enquiries", threshold: t, label: `Reached ${t} enquiries handled` });
  }
  for (const t of REVIEW_TIERS) {
    if (rep.metrics.reviewCount >= t) rows.push({ type: "reviews", threshold: t, label: `Collected ${t} reviews` });
  }
  for (const s of SCORE_TIERS) {
    if (rep.score >= s.at) rows.push({ type: "score", threshold: s.at, label: s.label });
  }
  for (const r of rows) {
    await query(
      `INSERT INTO dealer_milestones (dealer_id, type, threshold, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dealer_id, type, threshold) DO NOTHING`,
      [dealerId, r.type, r.threshold, r.label],
    ).catch(() => {});
  }
}

export async function getDealerMilestones(dealerId: string): Promise<Milestone[]> {
  return query<Milestone>(
    `SELECT type, threshold, label, created_at AS "createdAt"
     FROM dealer_milestones WHERE dealer_id = $1 ORDER BY created_at ASC`,
    [dealerId],
  );
}

// Ranking is only meaningful at scale. Gate it until the marketplace has
// enough approved, scored dealers for a percentile to mean anything.
export const RANKING_MIN_DEALERS = 10;

export interface DealerRanking {
  unlocked: boolean;
  totalDealers: number;       // approved dealers with a computed score
  topPercent: number | null;  // e.g. 3 => "Top 3%"; null until unlocked
}

export interface TrustedDealer {
  slug: string;
  businessName: string;
  location: string;
  score: number;
  rating: number | null;
  reviewCount: number;
}

// Homepage "Top Trusted Dealers" — only dealers that clear the trust bar:
// verified, score ≥ 80, and at least a few reviews (so it's earned, not noise).
export async function getTopTrustedDealers(limit = 6): Promise<TrustedDealer[]> {
  const rows = await query<{
    slug: string; businessName: string; location: string;
    score: number; rating: string | null; reviewCount: string;
  }>(
    `SELECT d.slug, d.business_name AS "businessName", d.location, d.score,
            rv.avg_rating AS rating, COALESCE(rv.review_count, 0) AS "reviewCount"
     FROM dealers d
     LEFT JOIN (
       SELECT dealer_id, AVG(rating)::NUMERIC(3,2) AS avg_rating, COUNT(*) AS review_count
       FROM reviews WHERE status = 'published' GROUP BY dealer_id
     ) rv ON rv.dealer_id = d.id
     WHERE d.status = 'approved' AND d.slug IS NOT NULL
       AND d.score >= 80 AND COALESCE(rv.review_count, 0) >= 3
     ORDER BY d.score DESC, rv.avg_rating DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    slug: r.slug, businessName: r.businessName, location: r.location,
    score: r.score,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: Number(r.reviewCount),
  }));
}

// Percentile of a dealer's score among all scored, approved dealers. Lower
// topPercent is better (Top 3% beats Top 25%). Counts dealers scoring >= mine
// so the best dealer is Top 1%, never Top 0%.
export async function getDealerRanking(myScore: number): Promise<DealerRanking> {
  const rows = await query<{ total: string; atOrAbove: string }>(
    `SELECT COUNT(*)::TEXT AS total,
            COUNT(*) FILTER (WHERE score >= $1)::TEXT AS "atOrAbove"
     FROM dealers WHERE status = 'approved' AND score IS NOT NULL`,
    [myScore],
  );
  const totalDealers = Number(rows[0]?.total ?? 0);
  const atOrAbove = Number(rows[0]?.atOrAbove ?? 0);
  const unlocked = totalDealers >= RANKING_MIN_DEALERS;
  const topPercent = unlocked && totalDealers > 0
    ? Math.max(1, Math.round((atOrAbove / totalDealers) * 100))
    : null;
  return { unlocked, totalDealers, topPercent };
}
