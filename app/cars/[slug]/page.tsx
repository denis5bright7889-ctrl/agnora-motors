import { notFound } from "next/navigation";
import { getCarBySlug as getCarBySlugFromDb, getDealerSlugForCar, isDbConfigured } from "@/lib/db";
import { CarDetail } from "./car-detail-client";

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

  // Deep-link to the dealer's public trust profile (null for private listings).
  const dealerSlug = await getDealerSlugForCar(car.id).catch(() => null);

  // No more static-catalogue "similar cars" filler. Linking to demo cars
  // that 404 on click is worse than no rail at all. Pass empty[] so the
  // CarDetail client hides the rail entirely (gated on `similar.length > 0`).
  // Restore a real similar-cars rail once we have a DB-backed implementation
  // that queries by body type + price band.
  return <CarDetail car={car} similar={[]} dealerSlug={dealerSlug} />;
}
