import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicCar, getPublicCars, isDbConfigured } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";

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

// Public, login-free car listing. Anyone can post — no account required.
const createSchema = z.object({
  sellerName: z.string().min(2).max(120),
  sellerPhone: z.string().min(9).max(20),
  year: z.coerce.number().min(1990).max(2026),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  price: z.coerce.number().min(100_000),
  mileage: z.coerce.number().min(0),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["auto", "manual"]),
  bodyType: z.enum(["suv", "sedan", "hatchback", "pickup", "coupe", "wagon", "van"]),
  condition: z.enum(["new", "used", "certified", "foreign_used", "locally_used"]),
  location: z.string().min(1),
  description: z.string().min(30),
  images: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  financingAvailable: z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
});

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Listings are not available right now." }, { status: 503 });
  }

  let data;
  try {
    data = createSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid listing" : "Invalid listing";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const car = await createPublicCar(data);
    publishEvent("listing_created", {
      carId: car.id, make: car.make, model: car.model,
      year: car.year, price: car.price, dealerId: null,
    }).catch(() => {});
    return NextResponse.json({ car }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cars]", err);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }
}
