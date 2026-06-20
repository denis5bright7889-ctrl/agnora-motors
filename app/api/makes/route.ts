import { NextResponse } from "next/server";
import { listMakes, isDbConfigured } from "@/lib/db";
import { STATIC_MAKES } from "@/data/makes";

export const runtime = "nodejs";

// Cache the makes list aggressively — taxonomy changes are rare.
export const revalidate = 3600;

export async function GET() {
  if (isDbConfigured()) {
    try {
      const makes = await listMakes();
      if (makes.length > 0) {
        return NextResponse.json({ makes, source: "db" });
      }
    } catch {
      // fall through to static
    }
  }

  return NextResponse.json({ makes: STATIC_MAKES, source: "static" });
}
