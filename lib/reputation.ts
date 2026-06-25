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

// Ranking is only meaningful at scale. Gate it until the marketplace has
// enough approved dealers; real percentile computation lands once there's a
// population to rank against.
export const RANKING_MIN_DEALERS = 10;

export interface DealerRanking {
  unlocked: boolean;
  totalDealers: number;
}

export async function getDealerRanking(): Promise<DealerRanking> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM dealers WHERE status = 'approved'`,
  );
  const totalDealers = Number(rows[0]?.count ?? 0);
  return { unlocked: totalDealers >= RANKING_MIN_DEALERS, totalDealers };
}
