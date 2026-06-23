import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicCar, getCarsByIds, getPublicCars, isDbConfigured, ListingQualityError } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { cars as STATIC_CARS } from "@/data/cars";
import type { Car, Specifications } from "@/types";

export const runtime = "nodejs";

const MAX_IDS_PER_REQUEST = 100;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ── Batch ID lookup (PR3d) ────────────────────────────────────────────────
  // Used by wishlist + recently-viewed to resolve localStorage IDs to full
  // Car records. Works against DB + static set so mixed IDs (legacy demo IDs
  // alongside real UUIDs) all resolve.
  const idsParam = searchParams.get("ids");
  if (idsParam !== null) {
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS_PER_REQUEST);

    if (ids.length === 0) {
      return NextResponse.json({ cars: [] });
    }

    const byId = new Map<string, Car>();

    if (isDbConfigured()) {
      try {
        const dbCars = await getCarsByIds(ids);
        for (const c of dbCars) byId.set(c.id, c);
      } catch (err) {
        console.error("[GET /api/cars?ids]", err instanceof Error ? err.message : err);
        // fall through to static
      }
    }

    // Static fallback for any IDs not resolved by the DB (covers demo IDs
    // and graceful degradation when the DB is empty).
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      const missingSet = new Set(missing);
      for (const c of STATIC_CARS) if (missingSet.has(c.id)) byId.set(c.id, c);
    }

    // Preserve the caller's input order — wishlist & recents care about it.
    const cars = ids
      .map((id) => byId.get(id))
      .filter((c): c is Car => c != null);

    return NextResponse.json({ cars });
  }

  // ── Existing search filter path ───────────────────────────────────────────
  if (!isDbConfigured()) {
    return NextResponse.json({ cars: [] });
  }

  const search       = searchParams.get("search")       ?? undefined;
  const condition    = searchParams.get("condition")    ?? undefined;
  const transmission = searchParams.get("transmission") ?? undefined;
  const makes        = searchParams.getAll("make").filter(Boolean);
  const bodies       = searchParams.getAll("body").filter(Boolean);
  const fuels        = searchParams.getAll("fuel").filter(Boolean);
  const locations    = searchParams.getAll("location").filter(Boolean);
  const minPrice     = searchParams.get("minPrice")    ? Number(searchParams.get("minPrice"))    : undefined;
  const maxPrice     = searchParams.get("maxPrice")    ? Number(searchParams.get("maxPrice"))    : undefined;
  const financing    = searchParams.get("financing")    === "true" ? true : undefined;
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
  // PR4b
  drivetrain:     z.enum(["fwd","rwd","awd","4wd"]).optional(),
  engineSizeL:    z.coerce.number().min(0.5).max(8.0).optional(),
  previousOwners: z.coerce.number().int().min(0).max(20).optional(),
  exteriorColor:  z.string().max(40).optional(),
  interiorColor:  z.string().max(40).optional(),
  // PR6b
  vin:                     z.string().min(11).max(20).optional(),
  vinVerified:             z.boolean().optional(),
  serviceHistoryAvailable: z.boolean().optional(),
  ownershipVerified:       z.boolean().optional(),
  inspectionAvailable:     z.boolean().optional(),
  // 2026-06-22 trust fields.
  // registrationNumber: 6–15 chars, server normalises whitespace. Stored as
  // private — never returned by public endpoints.
  registrationNumber:      z.string().min(4).max(15).optional(),
  mileageVerified:         z.boolean().optional(),
  logbookVerified:         z.boolean().optional(),
  accidentHistory:         z.enum(["none","minor_repaired","major_repaired","unknown"]).optional(),
  // Canonical Specifications shape (lib/types). Every numeric field is
  // independently optional + range-clamped here, so the JSONB can never
  // grow weird strings or out-of-range numbers from a malformed client.
  specifications: z.object({
    engineCc:           z.coerce.number().int().min(50).max(20_000).optional(),
    horsepower:         z.coerce.number().int().min(20).max(2_500).optional(),
    torqueNm:           z.coerce.number().int().min(20).max(5_000).optional(),
    // Pre-lowercase so external clients sending "AWD" / "4WD" still parse;
    // normalizeSpecifications() runs after this for the rest of the cleanup.
    drivetrain:         z.preprocess(
      (v) => typeof v === "string" ? v.toLowerCase() : v,
      z.enum(["fwd","rwd","awd","4wd"]).optional(),
    ),
    fuelEconomyKmL:     z.coerce.number().min(1).max(100).optional(),
    batteryCapacityKwh: z.coerce.number().min(1).max(500).optional(),
    rangeKm:            z.coerce.number().int().min(20).max(2_000).optional(),
    chargingTimeHours:  z.coerce.number().min(0.1).max(72).optional(),
    seats:              z.coerce.number().int().min(1).max(60).optional(),
    payloadKg:          z.coerce.number().int().min(50).max(50_000).optional(),
    towingCapacityKg:   z.coerce.number().int().min(50).max(50_000).optional(),
    exteriorColor:      z.string().max(40).optional(),
    interiorColor:      z.string().max(40).optional(),
    upholstery:         z.enum(["cloth","leather","leatherette","alcantara"]).optional(),
    previousOwners:     z.coerce.number().int().min(0).max(20).optional(),
  }).optional(),
});

/**
 * Belt-and-braces normaliser. Zod already clamps and whitelists; this drops
 * "" leaves, trims strings, lowercases the drivetrain enum, stamps
 * source="manual", and refuses any unknown key. Any future ingestion path
 * (VIN decoder, dealer import) routes its writes through this too.
 */
function normalizeSpecifications(
  s: z.infer<typeof createSchema>["specifications"] | undefined,
  topLevel: { drivetrain?: string; exteriorColor?: string; interiorColor?: string; previousOwners?: number },
) {
  // Merge any redundant top-level fields the form might still send so the
  // canonical place for these is always inside specifications.
  const merged = {
    ...(s ?? {}),
    drivetrain:     s?.drivetrain     ?? (topLevel.drivetrain     as Specifications["drivetrain"] | undefined),
    exteriorColor:  s?.exteriorColor  ?? topLevel.exteriorColor,
    interiorColor:  s?.interiorColor  ?? topLevel.interiorColor,
    previousOwners: s?.previousOwners ?? topLevel.previousOwners,
  };

  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length === 0 || t.length > max ? undefined : t;
  };

  const out: Specifications = {
    engineCc:           num(merged.engineCc,           50, 20_000),
    horsepower:         num(merged.horsepower,         20, 2_500),
    torqueNm:           num(merged.torqueNm,           20, 5_000),
    drivetrain:         typeof merged.drivetrain === "string"
      ? (["fwd","rwd","awd","4wd"].includes(merged.drivetrain.toLowerCase())
          ? merged.drivetrain.toLowerCase() as Specifications["drivetrain"]
          : undefined)
      : undefined,
    fuelEconomyKmL:     num(merged.fuelEconomyKmL,     1, 100),
    batteryCapacityKwh: num(merged.batteryCapacityKwh, 1, 500),
    rangeKm:            num(merged.rangeKm,            20, 2_000),
    chargingTimeHours:  num(merged.chargingTimeHours,  0.1, 72),
    seats:              num(merged.seats,              1, 60),
    payloadKg:          num(merged.payloadKg,          50, 50_000),
    towingCapacityKg:   num(merged.towingCapacityKg,   50, 50_000),
    exteriorColor:      str(merged.exteriorColor,      40),
    interiorColor:      str(merged.interiorColor,      40),
    upholstery:         ["cloth","leather","leatherette","alcantara"].includes(merged.upholstery as string)
      ? merged.upholstery as Specifications["upholstery"]
      : undefined,
    previousOwners:     num(merged.previousOwners,     0, 20),
    source:             "manual",
  };

  // Strip undefined leaves so the JSONB stays compact and predictable.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Specifications;
}

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

  // Normalise specs server-side: lowercase enums, trim strings, drop empty
  // leaves, clamp ranges, whitelist keys, stamp source. Even though zod
  // already validates the inbound shape, this also collapses redundant
  // top-level drivetrain/colors/owners fields into the specifications
  // object so storage is consistent.
  const normalisedSpecs = normalizeSpecifications(data.specifications, {
    drivetrain:     data.drivetrain,
    exteriorColor:  data.exteriorColor,
    interiorColor:  data.interiorColor,
    previousOwners: data.previousOwners,
  });

  try {
    const car = await createPublicCar({ ...data, specifications: normalisedSpecs });
    publishEvent("listing_created", {
      carId: car.id, make: car.make, model: car.model,
      year: car.year, price: car.price, dealerId: null,
    }).catch(() => {});
    return NextResponse.json({ car }, { status: 201 });
  } catch (err) {
    if (err instanceof ListingQualityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/cars]", err);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }
}
