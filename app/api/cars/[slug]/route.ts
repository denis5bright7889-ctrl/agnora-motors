import { NextResponse } from "next/server";
import { getCarBySlug, isDbConfigured } from "@/lib/db";
import { cars as STATIC_CARS, getCarBySlug as getStaticCarBySlug } from "@/data/cars";
import { isVisibleUnderPolicy } from "@/lib/quality-policy";

export const runtime = "nodejs";

// Public detail API. Uses the same visibility helper as /api/cars search, so
// whatever appears in /cars listing is reachable here, and anything hidden by
// the quality policy returns 404 — including via static fallback when the DB
// has no record for the slug.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // DB first — getCarBySlug already applies buildPublicListingVisibilityWhere
  // and logs (dev only) when a slug exists but fails the policy.
  if (isDbConfigured()) {
    const car = await getCarBySlug(slug).catch(() => null);
    if (car) return NextResponse.json({ car });
  }

  // Static fallback — demo data. Apply the same policy gate so the API can't
  // serve a static car that wouldn't pass for a real listing. Static cars all
  // pre-date the quality cutoff, so they're grandfathered through.
  const staticCar = getStaticCarBySlug(slug);
  if (staticCar) {
    const photoCount = staticCar.images?.length ?? 0;
    const visible = isVisibleUnderPolicy({
      createdAt:  staticCar.createdAt,
      photoCount,
      vin:        staticCar.vin,
    });
    if (visible) return NextResponse.json({ car: staticCar });
  }

  // Silence unused-import warning when STATIC_CARS isn't referenced directly.
  void STATIC_CARS;

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
