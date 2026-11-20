import { z } from "zod";
import { boundedNumber, optionalBoundedNumber, yearSchema } from "@/lib/vehicle-limits";
import { modelSchema, trimSchema, colourSchema, makeSchema } from "@/lib/model-name";
import { normalizeVin } from "@/lib/quality-policy";
import { validateIdentifier } from "@/lib/vin-validate";

// The vehicle fields every write path must agree on.
//
// This exists because /api/dealer/listings had NO field schema: it did
//     createDealerCar(dealer.id, { ...body, status })
// spreading the request body straight into the insert. Description quality
// was checked, and nothing else was — so a dealer account could POST
// mileage 1e+18 or model "iuytfgh7" directly and bypass every bound the
// public /api/cars path enforces. Validation that only one of two doors
// checks is not validation.
//
// Bounds are not redefined here; they come from lib/vehicle-limits.ts.

export const vehicleFieldsSchema = z.object({
  year:         yearSchema(),
  make:         makeSchema(),
  model:        modelSchema(),
  trim:         trimSchema(),
  price:        boundedNumber("priceKsh"),
  mileage:      boundedNumber("mileageKm", { unit: "km" }),
  fuel:         z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["auto", "manual"]),
  bodyType:     z.enum(["suv", "sedan", "hatchback", "pickup", "coupe", "wagon", "van"]),
  condition:    z.enum(["new", "used", "certified", "foreign_used", "locally_used"]),
  location:     z.string().trim().min(1, "Location required").max(120),

  drivetrain:     z.enum(["fwd", "rwd", "awd", "4wd"]).optional(),
  engineSizeL:    optionalBoundedNumber("engineSizeL", { unit: "litres" }),
  previousOwners: optionalBoundedNumber("previousOwners"),
  exteriorColor:  colourSchema("Exterior colour"),
  interiorColor:  colourSchema("Interior colour"),

  vin: z
    .string()
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

  // Remaining columns the dealer insert writes. They are listed here so the
  // route can stop spreading the raw request body: every key that reaches
  // the database is now one this schema named and type-checked.
  //
  // NOTE on the *Verified flags: these are SELLER-DECLARED. The dealer form
  // has a checkbox for each, so allowing them from the client is the
  // product's existing intent, not an oversight. What was missing was type
  // checking — they went in untouched from the body. Whether a self-declared
  // claim should render to buyers as a green "VIN verified" badge is a
  // product question, flagged rather than decided here.
  // Required: the insert writes a NOT-NULL-in-practice column, and the route
  // additionally runs assessDescription() for quality. Length is left to that
  // assessment rather than duplicated as a bare minimum here.
  description:           z.string(),
  images:                z.array(z.string()).default([]),
  features:              z.array(z.string()).default([]),
  financingAvailable:    z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
  vinVerified:             z.boolean().optional(),
  serviceHistoryAvailable: z.boolean().optional(),
  ownershipVerified:       z.boolean().optional(),
  inspectionAvailable:     z.boolean().optional(),
  mileageVerified:         z.boolean().optional(),
  logbookVerified:         z.boolean().optional(),
  registrationNumber:    z.preprocess((v) => (v === "" ? undefined : v),
                           z.string().trim().min(4).max(15).optional()),
  accidentHistory:       z.enum(["none", "minor_repaired", "major_repaired", "unknown"]).optional(),

  specifications: z
    .object({
      engineCc:           optionalBoundedNumber("engineCc", { unit: "cc" }),
      horsepower:         optionalBoundedNumber("horsepower", { unit: "hp" }),
      torqueNm:           optionalBoundedNumber("torqueNm", { unit: "Nm" }),
      fuelEconomyKmL:     optionalBoundedNumber("fuelEconomyKmL", { unit: "km/L" }),
      batteryCapacityKwh: optionalBoundedNumber("batteryCapacityKwh", { unit: "kWh" }),
      rangeKm:            optionalBoundedNumber("rangeKm", { unit: "km" }),
      chargingTimeHours:  optionalBoundedNumber("chargingTimeHours", { unit: "hours" }),
      seats:              optionalBoundedNumber("seats"),
      payloadKg:          optionalBoundedNumber("payloadKg", { unit: "kg" }),
      towingCapacityKg:   optionalBoundedNumber("towingCapacityKg", { unit: "kg" }),
      previousOwners:     optionalBoundedNumber("previousOwners"),
      drivetrain: z.preprocess(
        (v) => (typeof v === "string" ? v.toLowerCase() : v),
        z.enum(["fwd", "rwd", "awd", "4wd"]).optional(),
      ),
      upholstery:    z.enum(["cloth", "leather", "leatherette", "alcantara"]).optional(),
      exteriorColor: colourSchema("Exterior colour"),
      interiorColor: colourSchema("Interior colour"),
    })
    .partial()
    .optional(),
});

export type VehicleFields = z.infer<typeof vehicleFieldsSchema>;

/**
 * Turns Zod issues into one seller-facing message plus the field list, so an
 * API caller is told which field is wrong rather than "Invalid input".
 */
export function describeFieldIssues(error: z.ZodError): { error: string; fields: string[] } {
  const fields = [...new Set(error.issues.map((i) => i.path.join(".")).filter(Boolean))];
  const first = error.issues[0];
  return {
    error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid vehicle details.",
    fields,
  };
}
