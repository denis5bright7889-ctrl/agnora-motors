import { notFound } from "next/navigation";
import {
  getCarBySlug as getCarBySlugFromDb,
  isDbConfigured,
} from "@/lib/db";
import {
  getCarBySlug as getStaticCarBySlug,
  getSimilarCars,
} from "@/data/cars";
import { isVisibleUnderPolicy } from "@/lib/quality-policy";
import { CarDetail } from "./car-detail-client";

// Server component: resolves the listing on the server so /cars/[slug] uses
// the EXACT same visibility helper as /cars search — anything visible in
// search is reachable here, anything hidden returns 404. No filters beyond
// visibility (no dealer_id IS NOT NULL, no verified=true, no seller_type
// assumption) per the project spec.
export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1. DB first. getCarBySlug uses buildPublicListingVisibilityWhere internally
  //    and logs (dev only) when a row exists but fails the policy.
  let car = isDbConfigured() ? await getCarBySlugFromDb(slug).catch(() => null) : null;

  // 2. Static fallback — demo data. Apply the same policy gate so the static
  //    fallback can't show a car that wouldn't pass for a real listing.
  if (!car) {
    const staticCar = getStaticCarBySlug(slug);
    if (staticCar) {
      const visible = isVisibleUnderPolicy({
        createdAt:  staticCar.createdAt,
        photoCount: staticCar.images?.length ?? 0,
        vin:        staticCar.vin,
      });
      if (visible) car = staticCar;
    }
  }

  if (!car) notFound();

  // Similar cars are sourced from the static catalogue for now — the static
  // set provides the body-type variety needed for a useful "similar" rail
  // even when the DB only has a handful of listings.
  const similar = getSimilarCars(car, 3);

  return <CarDetail car={car} similar={similar} />;
}
