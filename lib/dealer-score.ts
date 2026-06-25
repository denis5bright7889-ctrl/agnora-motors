// Dealer reputation score v2 (0–100). Confidence-weighted so a brand-new
// dealer with 2 reviews isn't ranked the same as one with 200.
//
// Positive factors (relative weights, normalised to 100):
//   Verification 20 · Listing quality 15 · Response rate 15 ·
//   Lead conversion 15 · Reviews 20
// Penalties (points off): Complaints up to −15 · Strikes up to −20
//
// Factors with no data fall back to a neutral baseline rather than 0, so the
// score reflects "unproven" rather than "bad".

export type ScoreBand = "Excellent" | "Good" | "Average" | "Needs Attention";

export const MIN_PHOTOS = 6;

// Bayesian prior for reviews: assume an unproven dealer is ~3.5/5 until they
// accumulate enough reviews to move the needle. C = how many reviews it takes
// to roughly half-trust the observed average.
const REVIEW_PRIOR_MEAN = 3.5;
const REVIEW_CONFIDENCE_C = 10;

export interface DealerScoreInput {
  verified: boolean;
  activeListings: number;
  listingsWithEnoughPhotos: number;
  totalViews: number;
  totalLeads: number;
  respondedLeads: number;      // leads moved out of "new"
  reviewCount: number;
  reviewAverage: number;       // 1–5 (0 when no reviews)
  openComplaints: number;
  resolvedComplaints: number;
  strikeCount: number;
}

export interface DealerScoreResult {
  score: number;
  band: ScoreBand;
  reviewConfidence: number;    // 0–1, n/(n+C) — for "low/high confidence" UI
  factors: {
    verification: number; listingQuality: number; responseRate: number;
    conversion: number; reviews: number;
    complaintPenalty: number; strikePenalty: number;
  };
}

export function bandFor(score: number): ScoreBand {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Attention";
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export function computeDealerScore(i: DealerScoreInput): DealerScoreResult {
  // Positive factors, each 0–1.
  const verification = i.verified ? 1 : 0;
  const listingQuality = i.activeListings > 0
    ? i.listingsWithEnoughPhotos / i.activeListings
    : 0.7; // neutral — don't punish a dealer with no live listings yet
  const responseRate = i.totalLeads > 0
    ? i.respondedLeads / i.totalLeads
    : 0.65; // neutral until they have leads to respond to
  const conversion = i.totalViews > 0
    ? clamp01((i.totalLeads / i.totalViews) / 0.08)
    : 0.5; // neutral until there's traffic

  // Reviews — Bayesian average pulled toward the prior when n is small.
  const n = i.reviewCount;
  const sum = i.reviewAverage * n;
  const bayes = (REVIEW_CONFIDENCE_C * REVIEW_PRIOR_MEAN + sum) / (REVIEW_CONFIDENCE_C + n);
  const reviews = clamp01((bayes - 1) / 4);
  const reviewConfidence = n / (n + REVIEW_CONFIDENCE_C);

  const positiveRaw =
    20 * verification + 15 * listingQuality + 15 * responseRate + 15 * conversion + 20 * reviews;
  const positiveScore = (positiveRaw / 85) * 100;

  // Penalties. Resolved complaints count less than open ones.
  const complaintSeverity = i.openComplaints * 1 + i.resolvedComplaints * 0.3;
  const complaintPenalty = clamp01(complaintSeverity / 3) * 15;
  const strikePenalty = clamp01(i.strikeCount / 4) * 20;

  const score = Math.round(Math.max(0, Math.min(100, positiveScore - complaintPenalty - strikePenalty)));

  return {
    score,
    band: bandFor(score),
    reviewConfidence,
    factors: {
      verification: 20 * verification,
      listingQuality: 15 * listingQuality,
      responseRate: 15 * responseRate,
      conversion: 15 * conversion,
      reviews: 20 * reviews,
      complaintPenalty,
      strikePenalty,
    },
  };
}

// ── Trust badges ─────────────────────────────────────────────
// Earned, human-readable signals. Easier for buyers to parse than a number.

export interface BadgeInput {
  verified: boolean;
  score: number;
  reviewCount: number;
  reviewAverage: number;
  recommendPct: number | null;
  responseRate: number | null;     // 0–1
  avgResponseHours: number | null;
  totalLeads: number;
  totalComplaints: number;
  hasActivity: boolean;            // some listings or leads (don't award on nothing)
}

export interface Badge { id: string; label: string }

// ── Score explanation ────────────────────────────────────────
// Turns the score into a coaching tool: what's working, what to fix. Derived
// from the same inputs as the score so it always agrees with the number.

export interface ScoreExplanation {
  strengths: string[];
  improvements: string[];
}

export function explainDealerScore(i: DealerScoreInput): ScoreExplanation {
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (i.verified) strengths.push("Verified business");
  else improvements.push("Complete dealer verification");

  const qualityRatio = i.activeListings > 0 ? i.listingsWithEnoughPhotos / i.activeListings : 1;
  if (i.activeListings > 0) {
    if (qualityRatio >= 0.8) strengths.push("High-quality listings with enough photos");
    else improvements.push(`Add more photos — aim for ${MIN_PHOTOS}+ per listing`);
  }

  if (i.totalLeads > 0) {
    const responseRate = i.respondedLeads / i.totalLeads;
    if (responseRate >= 0.8) strengths.push("Fast, consistent responses to buyers");
    else improvements.push("Respond to more of your leads");
  }

  if (i.totalViews >= 30) {
    const conv = i.totalLeads / i.totalViews;
    if (conv >= 0.05) strengths.push("Strong view-to-lead conversion");
    else improvements.push("Improve listing appeal (price, photos, description) to convert views");
  }

  if (i.reviewCount >= 5 && i.reviewAverage >= 4) strengths.push("Strong customer reviews");
  else improvements.push("Collect more reviews from happy buyers");

  if (i.openComplaints > 0) improvements.push("Resolve your open complaints");
  if (i.strikeCount > 0) improvements.push("Avoid policy strikes — review listing guidelines");

  return { strengths, improvements };
}

export function computeDealerBadges(b: BadgeInput): Badge[] {
  const out: Badge[] = [];
  if (b.verified) out.push({ id: "verified", label: "Verified Business" });
  if (b.score >= 80) out.push({ id: "trusted", label: "Trusted Dealer" });
  if (b.reviewCount >= 5 && (b.recommendPct ?? 0) >= 90) out.push({ id: "recommended", label: "Highly Recommended" });
  if (b.avgResponseHours !== null && b.avgResponseHours <= 2) out.push({ id: "fast", label: "Fast Response" });
  if (b.totalLeads >= 10 && (b.responseRate ?? 0) >= 0.9) out.push({ id: "top_responder", label: "Top Responder" });
  if (b.hasActivity && b.totalComplaints === 0) out.push({ id: "complaint_free", label: "Complaint Free" });
  return out;
}
