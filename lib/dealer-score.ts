// Dealer reputation score (0–100). Computed only from signals we actually
// track today: verification status, active-strike count, listing quality
// (photo completeness), and lead-conversion. Response-rate and complaint-rate
// are weighted in once the Lead CRM (Phase 2) and Complaints center (Phase 4)
// land — until then their sub-weights are redistributed to the known factors
// so the score stays meaningful rather than artificially low.

export type ScoreBand = "Excellent" | "Good" | "Average" | "Needs Attention";

export interface DealerScoreInput {
  verified: boolean;        // dealer.status === "approved"
  strikeCount: number;      // active strikes
  activeListings: number;
  listingsWithEnoughPhotos: number; // active listings with >= MIN_PHOTOS
  totalViews: number;
  totalLeads: number;
}

export interface DealerScoreResult {
  score: number;            // 0–100, rounded
  band: ScoreBand;
}

const MIN_PHOTOS = 6;

export { MIN_PHOTOS };

export function bandFor(score: number): ScoreBand {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Attention";
}

export function computeDealerScore(input: DealerScoreInput): DealerScoreResult {
  const {
    verified, strikeCount, activeListings,
    listingsWithEnoughPhotos, totalViews, totalLeads,
  } = input;

  // Verification — 35 pts.
  const verificationPts = verified ? 35 : 12;

  // Listing quality — 30 pts. Share of active listings with enough photos.
  // No listings yet → neutral (don't punish a brand-new dealer).
  const qualityRatio = activeListings > 0 ? listingsWithEnoughPhotos / activeListings : 1;
  const qualityPts = 30 * qualityRatio;

  // Lead conversion — 20 pts. leads / views, capped at a healthy 8%.
  const conversion = totalViews > 0 ? totalLeads / totalViews : 0;
  const conversionPts = 20 * Math.min(conversion / 0.08, 1);

  // Standing — 15 pts, eroded 5 pts per active strike.
  const standingPts = Math.max(0, 15 - strikeCount * 5);

  const score = Math.round(
    Math.max(0, Math.min(100, verificationPts + qualityPts + conversionPts + standingPts)),
  );

  return { score, band: bandFor(score) };
}
