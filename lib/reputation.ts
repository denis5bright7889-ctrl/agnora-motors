import { query, getDealerCars, getDealerAccountHealth } from "@/lib/db";
import { getDealerLeads } from "@/lib/leads";
import { getDealerReviewSummary, getDealerComplaintStats } from "@/lib/trust";
import {
  computeDealerScore, computeDealerBadges, MIN_PHOTOS,
  type Badge, type ScoreBand,
} from "@/lib/dealer-score";

// Single source of truth for a dealer's reputation — assembled from cars,
// leads, reviews and complaints. Used by the dealer home, the public profile
// and ranking so the score is identical everywhere.

export interface DealerReputation {
  score: number;
  band: ScoreBand;
  reviewConfidence: number;
  badges: Badge[];
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

  const detail = computeDealerScore({
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
  });

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
  } catch {
    /* non-fatal */
  }
}

// Ranking is only meaningful at scale. Gate it until the marketplace has
// enough approved dealers; real percentile computation lands once there's a
// population to rank against.
export const RANKING_MIN_DEALERS = 10;

export interface DealerRanking {
  unlocked: boolean;
  totalDealers: number;
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

export async function getDealerRanking(): Promise<DealerRanking> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM dealers WHERE status = 'approved'`,
  );
  const totalDealers = Number(rows[0]?.count ?? 0);
  return { unlocked: totalDealers >= RANKING_MIN_DEALERS, totalDealers };
}
