import { CarsListing } from "@/components/cars-listing";
import { isDbConfigured, searchCarsDb } from "@/lib/db";
import { parseSearchParams, type SearchResponse } from "@/lib/search";

export const metadata = {
  title: "Buy Cars in Kenya — Agnora Motors",
  description: "Browse verified cars for sale in Kenya. Filter by make, price, location, and more.",
};

// Server-side render is dynamic because results depend on query string.
export const dynamic = "force-dynamic";

// Empty SearchResponse — used when the DB is empty / unreachable. CarsListing
// already handles total=0 with a real empty state (no demo data leaks in).
const EMPTY: SearchResponse = {
  cars:       [],
  total:      0,
  page:       1,
  limit:      20,
  totalPages: 0,
  facets: {
    makes:          [],
    bodyTypes:      [],
    fuels:          [],
    conditions:     [],
    locations:      [],
    transmissions:  [],
    drivetrains:    [],
    exteriorColors: [],
    sellerTypes:    [],
  },
  source: "db",
};

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

  // No DB → empty list. We DELIBERATELY no longer fall back to the demo
  // catalogue in /data/cars: those listings aren't real, never had real
  // sellers, and showed up on the marketplace UI looking indistinguishable
  // from real cars — confusing for buyers, misleading for the funnel.
  if (!isDbConfigured()) {
    return <CarsListing initial={EMPTY} />;
  }

  try {
    const initial = await searchCarsDb(filters);
    return <CarsListing initial={initial} />;
  } catch (err) {
    console.error("[/cars] search failed:", err instanceof Error ? err.message : err);
    return <CarsListing initial={EMPTY} />;
  }
}
