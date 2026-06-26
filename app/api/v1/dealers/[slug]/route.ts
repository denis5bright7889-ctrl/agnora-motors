import { ok, fail } from "@/lib/api/respond";
import { reviewDTO, vehicleDTO, milestoneDTO } from "@/lib/api/dto";
import { getDealerProfileBySlug, getDealerCars, isDbConfigured } from "@/lib/db";
import { getDealerReputation, getDealerMilestones } from "@/lib/reputation";
import { getDealerReviews } from "@/lib/trust";

export const runtime = "nodejs";

// Public dealer trust profile — score, badges, rating, response, timeline,
// reviews and active listings. No auth (it's the buyer's decision page).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isDbConfigured()) return fail("UNAVAILABLE", "Profiles are unavailable right now.");
  const { slug } = await params;

  const dealer = await getDealerProfileBySlug(slug).catch(() => null);
  if (!dealer || dealer.status !== "approved") return fail("NOT_FOUND", "Dealer not found.");

  const [rep, reviews, cars, milestones] = await Promise.all([
    getDealerReputation(dealer.id),
    getDealerReviews(dealer.id, 20),
    getDealerCars(dealer.id),
    getDealerMilestones(dealer.id),
  ]);
  const listings = cars.filter((c) => c.status === "active");

  return ok({
    slug: dealer.slug,
    businessName: dealer.businessName,
    location: dealer.location,
    memberSince: dealer.createdAt,
    verified: true,
    score: rep.score,
    band: rep.band,
    badges: rep.badges,
    rating: rep.metrics.reviewAverage,
    reviewCount: rep.metrics.reviewCount,
    recommendPct: rep.metrics.recommendPct,
    avgResponseHours: rep.metrics.avgResponseHours,
    vehiclesListed: listings.length,
    timeline: milestones.map(milestoneDTO),
    reviews: reviews.map(reviewDTO),
    listings: listings.map(vehicleDTO),
  });
}
