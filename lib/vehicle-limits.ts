import { z } from "zod";

// Numeric bounds for vehicle fields, in one place so the browser and the
// server cannot drift apart. Both import from here.
//
// WHY THE LIMITS ARE WHAT THEY ARE — every bound below is justified, because
// a number pulled out of the air is just a different bug:
//
//   mileage      0 – 1,500,000 km
//     The hard ceiling is the database: cars.mileage is a Postgres INTEGER,
//     which stops at 2,147,483,647. Anything above that was never going to be
//     stored — it produced a 500 from the driver instead of a validation
//     message. 1.5M km sits comfortably under that and comfortably above any
//     vehicle this marketplace lists: the supported body types are suv,
//     sedan, hatchback, pickup, coupe, wagon and van, not heavy haulage.
//
//   price        100,000 – 1,000,000,000 KSh
//     The minimum already existed in both schemas and is unchanged. The
//     maximum is an absurdity ceiling, not a market judgement — KSh 1bn is
//     roughly 50x the most expensive vehicle ever listed in this market, so
//     it refuses typos and overflow without second-guessing a real seller.
//
//   year         1990 – (current year + 1)
//     1990 is the existing floor and is unchanged. The ceiling was the
//     literal 2026, which silently becomes wrong on 1 January. Deriving it
//     keeps the intent — "this model year or next, for cars arriving early" —
//     without going stale.
//
// The remaining bounds (engine, power, torque, economy, battery, range,
// charging, seats, payload, towing, owners) are the ones ALREADY enforced by
// the server schema. They are moved here unchanged so there is a single
// definition; none of them is loosened.

export const VEHICLE_LIMITS = {
  mileageKm:          { min: 0,       max: 1_500_000, int: true },
  priceKsh:           { min: 100_000, max: 1_000_000_000, int: true },
  engineCc:           { min: 50,      max: 20_000,  int: true },
  horsepower:         { min: 20,      max: 2_500,   int: true },
  torqueNm:           { min: 20,      max: 5_000,   int: true },
  fuelEconomyKmL:     { min: 1,       max: 100,     int: false },
  batteryCapacityKwh: { min: 1,       max: 500,     int: false },
  rangeKm:            { min: 20,      max: 2_000,   int: true },
  chargingTimeHours:  { min: 0.1,     max: 72,      int: false },
  seats:              { min: 1,       max: 60,      int: true },
  payloadKg:          { min: 50,      max: 50_000,  int: true },
  towingCapacityKg:   { min: 50,      max: 50_000,  int: true },
  previousOwners:     { min: 0,       max: 20,      int: true },
  engineSizeL:        { min: 0.5,     max: 8.0,     int: false },
} as const;

export type VehicleLimitKey = keyof typeof VEHICLE_LIMITS;

/** Earliest model year the marketplace lists. Unchanged from the original schema. */
export const MIN_YEAR = 1990;

/** Latest accepted model year: next year, so early arrivals can be listed. */
export function maxYear(now: Date = new Date()): number {
  return now.getUTCFullYear() + 1;
}

/**
 * Converts form/JSON input to a number without the traps of `Number()`.
 *
 * Specifically:
 *   - "" and null mean "not provided", NOT 0. `Number("")` is 0, which is how
 *     a blank mileage box could have been stored as a genuine 0 km.
 *   - NaN, Infinity and -Infinity are rejected rather than coerced.
 *   - values beyond Number.MAX_SAFE_INTEGER are rejected, because past that
 *     point arithmetic and round-tripping stop being exact.
 *
 * Scientific notation is NOT banned outright — "1e3" is a perfectly ordinary
 * way to write 1000, and some locales' tooling emits it. It is the VALUE that
 * must be in range. "1e+18" is refused because 10^18 km is absurd, not
 * because of how it was spelled.
 */
export function toFiniteNumber(input: unknown): number | undefined {
  if (input === null || input === undefined) return undefined;

  // Only a number or a string may become a number. This is not pedantry:
  // Number([]) is 0 and Number([7]) is 7, so an array posted to the API would
  // otherwise convert into a perfectly valid-looking value. Booleans convert
  // to 0 and 1 for the same reason.
  if (typeof input !== "number" && typeof input !== "string") return undefined;
  if (typeof input === "string" && input.trim() === "") return undefined;

  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return undefined;          // NaN, Infinity, -Infinity
  if (!Number.isSafeInteger(Math.trunc(n))) return undefined; // beyond 2^53
  return n;
}

function describe(min: number, max: number, unit?: string): string {
  const u = unit ? ` ${unit}` : "";
  return `Enter a value between ${min.toLocaleString()} and ${max.toLocaleString()}${u}.`;
}

/**
 * A required numeric field, bounded and safe.
 *
 * Note the deliberate ordering: the value is normalised to a real finite
 * number FIRST, then range-checked. Validating before normalising is what let
 * "1e+18" through — it is a valid `z.coerce.number()`, it is `> 0`, and with
 * no upper bound there was nothing left to stop it.
 */
export function boundedNumber(
  key: VehicleLimitKey,
  opts: { unit?: string; message?: string } = {},
) {
  const { min, max, int } = VEHICLE_LIMITS[key];
  const message = opts.message ?? describe(min, max, opts.unit);

  return z.preprocess(
    (v) => toFiniteNumber(v) ?? v,   // leave unconvertible input for z.number() to reject
    // invalid_type_error carries the SAME guidance as the range check.
    // Without it, a value too large to convert safely (1e+18 exceeds
    // MAX_SAFE_INTEGER, so toFiniteNumber refuses it) fell through to Zod's
    // default and the seller was shown "Expected number, received string" —
    // which is true, and useless.
    (int
      ? z.number({ invalid_type_error: message, required_error: message }).int(message)
      : z.number({ invalid_type_error: message, required_error: message }))
      .finite(message)
      .min(min, message)
      .max(max, message),
  );
}

/** The same bounds, but the field may be omitted entirely. */
export function optionalBoundedNumber(
  key: VehicleLimitKey,
  opts: { unit?: string; message?: string } = {},
) {
  const { min, max, int } = VEHICLE_LIMITS[key];
  const message = opts.message ?? describe(min, max, opts.unit);

  return z.preprocess(
    (v) => {
      const n = toFiniteNumber(v);
      // An unconvertible non-empty value must still FAIL, not vanish: if the
      // seller typed "abc" into horsepower, silently dropping the field would
      // publish a listing that quietly ignored their input.
      if (n === undefined) return v === "" || v == null ? undefined : v;
      return n;
    },
    (int
      ? z.number({ invalid_type_error: message }).int(message)
      : z.number({ invalid_type_error: message }))
      .finite(message)
      .min(min, message)
      .max(max, message)
      .optional(),
  );
}

/** Model year, with a ceiling that does not go stale. */
export function yearSchema(now: Date = new Date()) {
  const max = maxYear(now);
  const message = `Enter a model year between ${MIN_YEAR} and ${max}.`;
  return z.preprocess(
    (v) => toFiniteNumber(v) ?? v,
    z.number().int(message).finite(message).min(MIN_YEAR, message).max(max, message),
  );
}

/**
 * True when a number is safe to format for display.
 *
 * The live preview called `Number(value).toLocaleString()` directly, which
 * turned the nonsense "1e+18" into the authoritative-looking
 * "1,000,000,000,000,000,000 km". Formatting is what made it look real, so
 * formatting is where this check belongs.
 */
export function isDisplayableNumber(
  value: unknown,
  key?: VehicleLimitKey,
): value is number {
  const n = toFiniteNumber(value);
  if (n === undefined) return false;
  if (!key) return true;
  const { min, max } = VEHICLE_LIMITS[key];
  return n >= min && n <= max;
}

/**
 * Formats a number for the buyer-facing preview, or returns null when the
 * value is not something we are willing to stand behind. Callers render the
 * null case as "—", never as a number.
 */
export function formatIfValid(
  value: unknown,
  key: VehicleLimitKey,
  suffix = "",
): string | null {
  if (!isDisplayableNumber(value, key)) return null;
  return `${Number(value).toLocaleString()}${suffix}`;
}
