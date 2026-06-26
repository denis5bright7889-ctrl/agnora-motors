import { requireDealer } from "@/lib/api/guards";
import { ok } from "@/lib/api/respond";
import { reviewDTO, complaintDTO } from "@/lib/api/dto";
import {
  getDealerReviewSummary, getDealerReviews,
  getDealerComplaints, getDealerComplaintStats,
} from "@/lib/trust";

export const runtime = "nodejs";

// Dealer trust centre — review summary + recent reviews, complaint stats + list.
export async function GET() {
  const g = await requireDealer();
  if (!g.ok) return g.response;

  const [reviewSummary, reviews, complaintStats, complaints] = await Promise.all([
    getDealerReviewSummary(g.dealer.id),
    getDealerReviews(g.dealer.id, 50),
    getDealerComplaintStats(g.dealer.id),
    getDealerComplaints(g.dealer.id),
  ]);

  return ok({
    reviews: { summary: reviewSummary, items: reviews.map(reviewDTO) },
    complaints: { stats: complaintStats, items: complaints.map(complaintDTO) },
  });
}
