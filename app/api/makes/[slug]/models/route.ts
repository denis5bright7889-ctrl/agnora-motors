import { NextResponse } from "next/server";
import { listModelsByMakeSlug, getMakeBySlug, isDbConfigured } from "@/lib/db";
import { getStaticMakeBySlug, getStaticModelsByMakeSlug } from "@/data/makes";

export const runtime = "nodejs";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (isDbConfigured()) {
    try {
      const make = await getMakeBySlug(slug);
      if (make) {
        const models = await listModelsByMakeSlug(slug);
        return NextResponse.json({ make, models, source: "db" });
      }
    } catch {
      // fall through to static
    }
  }

  const staticMake = getStaticMakeBySlug(slug);
  if (!staticMake) {
    return NextResponse.json({ error: "Make not found" }, { status: 404 });
  }
  const models = getStaticModelsByMakeSlug(slug);
  return NextResponse.json({ make: staticMake, models, source: "static" });
}
