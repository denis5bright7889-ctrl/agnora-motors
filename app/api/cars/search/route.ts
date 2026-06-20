import { NextResponse } from "next/server";
import { isDbConfigured, searchCarsDb } from "@/lib/db";
import { parseSearchParams, searchCarsStatic } from "@/lib/search";
import { cars as staticCars } from "@/data/cars";

export const runtime = "nodejs";

// Always dynamic — search results depend on query string.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filters = parseSearchParams(searchParams);

  if (isDbConfigured()) {
    try {
      const response = await searchCarsDb(filters);
      // If DB is wired but has no rows yet, fall through to the static set so
      // local/preview environments still show something useful.
      if (response.total > 0) {
        return NextResponse.json(response);
      }
    } catch (err) {
      console.error("[/api/cars/search] DB error:", err instanceof Error ? err.message : err);
      // fall through to static
    }
  }

  return NextResponse.json(searchCarsStatic(staticCars, filters));
}
