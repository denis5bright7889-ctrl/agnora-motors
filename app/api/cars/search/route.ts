import { NextResponse } from "next/server";
import { isDbConfigured, searchCarsDb } from "@/lib/db";
import { parseSearchParams } from "@/lib/search";
import type { SearchResponse } from "@/lib/search";

export const runtime = "nodejs";

// Always dynamic — search results depend on query string.
export const dynamic = "force-dynamic";

// Empty response shape — used when DB is empty or unreachable. We
// deliberately no longer fall back to the demo catalogue: those listings
// aren't real and showing them on the public marketplace UI was confusing
// for buyers.
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filters = parseSearchParams(searchParams);

  if (!isDbConfigured()) return NextResponse.json(EMPTY);

  try {
    return NextResponse.json(await searchCarsDb(filters));
  } catch (err) {
    console.error("[/api/cars/search] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json(EMPTY);
  }
}
