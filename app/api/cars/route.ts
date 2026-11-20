import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  createPublicCar, getCarsByIds, getPublicCars, isDbConfigured, assertImagesOwnedBy,
  ListingQualityError, updateUserRole, setSellerTypeIfUnset,
} from "@/lib/db";
import { normalizeVin } from "@/lib/quality-policy";
import { assessDescription, descriptionSchema } from "@/lib/description-quality";
import { validateIdentifier } from "@/lib/vin-validate";
import { boundedNumber, optionalBoundedNumber, yearSchema } from "@/lib/vehicle-limits";
import { modelSchema, trimSchema, colourSchema, makeSchema } from "@/lib/model-name";
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

// Private-seller listing. Requires a signed-in, email-verified account; the
// owning user is taken from the session, never from the request body.
const createSchema = z.object({
  sellerName: z.string().min(2).max(120),
  sellerPhone: z.string().min(9).max(20),
  // Bounds come from lib/vehicle-limits.ts so the browser and this route
  // cannot disagree. `mileage` previously had NO upper bound on either side,
  // which is how "1e+18" passed validation and died at the database instead:
  // cars.mileage is a Postgres INTEGER, so the driver raised a numeric
  // overflow and the seller saw a 500 rather than a reason.
  year: yearSchema(),
  make: makeSchema(),
  model: modelSchema(),
  trim: trimSchema(),
  price: boundedNumber("priceKsh"),
  mileage: boundedNumber("mileageKm", { unit: "km" }),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["auto", "manual"]),
  bodyType: z.enum(["suv", "sedan", "hatchback", "pickup", "coupe", "wagon", "van"]),
  condition: z.enum(["new", "used", "certified", "foreign_used", "locally_used"]),
  location: z.string().min(1),
  // Delegated to lib/description-quality.ts so the seller gets the actual
  // reason. A bare min(30) is what let "uhygby7gbygb y hgbyt67tg gy76ygt6tyg"
  // (36 characters) publish. Only a confident rejection fails here; an
  // uncertain description is accepted and held for review below.
  description: descriptionSchema(),
  images: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  financingAvailable: z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
  // PR4b
  drivetrain:     z.enum(["fwd","rwd","awd","4wd"]).optional(),
  engineSizeL:    optionalBoundedNumber("engineSizeL", { unit: "litres" }),
  previousOwners: optionalBoundedNumber("previousOwners"),
  exteriorColor:  colourSchema("Exterior colour"),
  interiorColor:  colourSchema("Interior colour"),
  // PR6b — normalised before the length check so a VIN typed with dashes or
  // spaces is judged on its real content, and so the stored value doesn't
  // depend on whether it was typed on a phone keyboard or pasted on a desktop.
  // Validation is delegated to lib/vin-validate.ts so the seller gets the
  // actual reason rather than one generic length complaint. A well-formed
  // Japanese chassis number, or an identifier in a format we don't model yet,
  // is accepted and flagged for review - only a structurally broken
  // identifier is refused here.
  vin: z.string()
    .transform(normalizeVin)
    .superRefine((v, ctx) => {
      const result = validateIdentifier(v);
      if (!result.acceptable) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message ?? "That VIN or chassis number isn't valid.",
        });
      }
    })
    .optional(),
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
    engineCc:           optionalBoundedNumber("engineCc", { unit: "cc" }),
    horsepower:         optionalBoundedNumber("horsepower", { unit: "hp" }),
    torqueNm:           optionalBoundedNumber("torqueNm", { unit: "Nm" }),
    // Pre-lowercase so external clients sending "AWD" / "4WD" still parse;
    // normalizeSpecifications() runs after this for the rest of the cleanup.
    drivetrain:         z.preprocess(
      (v) => typeof v === "string" ? v.toLowerCase() : v,
      z.enum(["fwd","rwd","awd","4wd"]).optional(),
    ),
    fuelEconomyKmL:     optionalBoundedNumber("fuelEconomyKmL", { unit: "km/L" }),
    batteryCapacityKwh: optionalBoundedNumber("batteryCapacityKwh", { unit: "kWh" }),
    rangeKm:            optionalBoundedNumber("rangeKm", { unit: "km" }),
    chargingTimeHours:  optionalBoundedNumber("chargingTimeHours", { unit: "hours" }),
    seats:              optionalBoundedNumber("seats"),
    payloadKg:          optionalBoundedNumber("payloadKg", { unit: "kg" }),
    towingCapacityKg:   optionalBoundedNumber("towingCapacityKg", { unit: "kg" }),
    exteriorColor:      colourSchema("Exterior colour"),
    interiorColor:      colourSchema("Interior colour"),
    upholstery:         z.enum(["cloth","leather","leatherette","alcantara"]).optional(),
    previousOwners:     optionalBoundedNumber("previousOwners"),
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to publish a listing.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!session.user.emailVerified && session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Verify your email address before publishing a listing.", code: "email_unverified" },
      { status: 403 },
    );
  }

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
    // The schema already refused a confidently bad description. What remains
    // is the uncertain band, which must not publish unseen — previously every
    // listing took the column default of 'active', so there was no review
    // step at all on this path.
    const description = assessDescription(data.description);

    // Photos must belong to the account publishing them. Listing creation
    // previously read the upload record by URL without ever checking who
    // uploaded it, so another user's photos could be attached.
    await assertImagesOwnedBy(session.user.id, data.images);

    const car = await createPublicCar({
      ...data,
      specifications: normalisedSpecs,
      sellerName: data.sellerName.trim() || session.user.name || "Private seller",
      sellerUserId: session.user.id,
      status: description.verdict === "review" ? "pending_review" : "active",
    });

    // A buyer who publishes their first car becomes a private seller, so the
    // seller dashboard (which the middleware gates on this role) opens for them.
    if (session.user.role === "buyer") {
      updateUserRole(session.user.id, "private_seller").catch(() => {});
    }

    // Seller type is a separate axis from role and from verification: listing a
    // car makes you a one-time seller, and says nothing about whether you are
    // verified. Never overwrites an existing dealer/verified_seller value.
    setSellerTypeIfUnset(session.user.id, "one_time_seller").catch(() => {});

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
