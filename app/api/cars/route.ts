import { NextResponse } from "next/server";
import { getPublicCars, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ cars: [] });
  }

  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") ?? undefined;
  const condition = searchParams.get("condition") ?? undefined;
  const transmission = searchParams.get("transmission") ?? undefined;
  const makes = searchParams.getAll("make").filter(Boolean);
  const bodies = searchParams.getAll("body").filter(Boolean);
  const fuels = searchParams.getAll("fuel").filter(Boolean);
  const locations = searchParams.getAll("location").filter(Boolean);
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const financing = searchParams.get("financing") === "true" ? true : undefined;
  const hirePurchase = searchParams.get("hirePurchase") === "true" ? true : undefined;

  try {
    const cars = await getPublicCars({
      search, condition, transmission, makes, bodies, fuels, locations,
      minPrice, maxPrice, financing, hirePurchase,
    });
    return NextResponse.json({ cars });
  } catch (err) {
    console.error("[GET /api/cars]", err);
    return NextResponse.json({ cars: [], error: "Failed to fetch cars" }, { status: 500 });
  }
}
