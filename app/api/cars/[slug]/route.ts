import { NextResponse } from "next/server";
import { getCarBySlug, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

// Public detail API. Uses the same visibility helper as /api/cars search, so
// whatever appears in /cars listing is reachable here, and anything hidden by
// the quality policy returns 404.
//
// We deliberately no longer fall back to the demo catalogue — direct URLs to
// demo slugs 404 cleanly so the marketplace can't accidentally serve listings
// nobody actually posted.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (isDbConfigured()) {
    const car = await getCarBySlug(slug).catch(() => null);
    if (car) return NextResponse.json({ car });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
