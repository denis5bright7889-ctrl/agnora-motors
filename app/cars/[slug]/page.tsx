import { notFound } from "next/navigation";
import {
  getCarBySlug as getCarBySlugFromDb, getDealerSlugForCar,
  getDealerProfileBySlug, isDbConfigured,
} from "@/lib/db";
import { getDealerReputation } from "@/lib/reputation";
import { CarDetail, type DealerTrust } from "./car-detail-client";

// Server component: resolves the listing on the server so /cars/[slug] uses
// the EXACT same visibility helper as /cars search — anything visible in
// search is reachable here, anything hidden returns 404. No filters beyond
// visibility (no dealer_id IS NOT NULL, no verified=true, no seller_type
// assumption) per the project spec.
//
// We DELIBERATELY no longer fall back to the demo catalogue: direct URLs to
// demo slugs now 404 cleanly so the marketplace can't accidentally show
// listings nobody actually posted.
export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const car = isDbConfigured()
    ? await getCarBySlugFromDb(slug).catch(() => null)
    : null;

  if (!car) notFound();

  // Resolve the selling dealer's trust signals for the detail trust panel.
  const dealerSlug = await getDealerSlugForCar(car.id).catch(() => null);
  let dealerTrust: DealerTrust | null = null;
  if (dealerSlug) {
    const profile = await getDealerProfileBySlug(dealerSlug).catch(() => null);
    if (profile) {
      const rep = await getDealerReputation(profile.id);
      dealerTrust = {
        slug: dealerSlug,
        score: rep.score,
        band: rep.band,
        badges: rep.badges,
        rating: rep.metrics.reviewAverage,
        reviewCount: rep.metrics.reviewCount,
        recommendPct: rep.metrics.recommendPct,
        avgResponseHours: rep.metrics.avgResponseHours,
      };
    }
  }

  // No more static-catalogue "similar cars" filler. Linking to demo cars
  // that 404 on click is worse than no rail at all. Pass empty[] so the
  // CarDetail client hides the rail entirely (gated on `similar.length > 0`).
  // Restore a real similar-cars rail once we have a DB-backed implementation
  // that queries by body type + price band.
  return <CarDetail car={car} similar={[]} dealerSlug={dealerSlug} dealerTrust={dealerTrust} />;
}
