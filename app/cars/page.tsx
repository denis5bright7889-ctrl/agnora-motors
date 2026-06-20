import { CarsListing } from "@/components/cars-listing";
import { isDbConfigured, searchCarsDb } from "@/lib/db";
import { parseSearchParams, searchCarsStatic, type SearchResponse } from "@/lib/search";
import { cars as STATIC_CARS } from "@/data/cars";

export const metadata = {
  title: "Buy Cars in Kenya — Agnora Motors",
  description: "Browse verified cars for sale in Kenya. Filter by make, price, location, and more.",
};

// Server-side render is dynamic because results depend on query string.
export const dynamic = "force-dynamic";

function toUrlSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else                   sp.append(k, v);
  }
  return sp;
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw     = await searchParams;
  const filters = parseSearchParams(toUrlSearchParams(raw));

  let initial: SearchResponse;
  if (isDbConfigured()) {
    try {
      initial = await searchCarsDb(filters);
      // If DB is wired but empty, fall through to the static set so dev/preview
      // environments still render content.
      if (initial.total === 0) {
        initial = searchCarsStatic(STATIC_CARS, filters);
      }
    } catch (err) {
      console.error("[/cars] search failed:", err instanceof Error ? err.message : err);
      initial = searchCarsStatic(STATIC_CARS, filters);
    }
  } else {
    initial = searchCarsStatic(STATIC_CARS, filters);
  }

  return <CarsListing initial={initial} />;
}
