// VIN decoder. Primary source today is NHTSA vPIC — a free, no-key US
// government service whose coverage is strongest for US-spec cars. JDM
// imports (which dominate the Kenya market) often return empty results,
// which we surface as "no match" rather than an error.
//
// Architecture is a chain-of-decoders so we can add a JDM-specialised
// provider (vindecoder.eu, decoderz.com) later without changing callers:
//   decodeVin(vin) → checkCache → tryNhtsa → (future: tryJdmProvider) → null
//
// Output is shaped to match what our form / Specifications type expect so
// the caller can splat into setValue() without per-field translation.

import { query } from "@/lib/db";
import type { Fuel, Transmission, BodyType, Drivetrain } from "@/types";

const NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinExtended";

/**
 * Subset of fields the decoder can fill. Every field optional — partial
 * decodes are normal. `year`, `make`, `model` are the most reliable signals.
 */
export interface DecodedVehicle {
  year?:         number;
  make?:         string;
  model?:        string;
  trim?:         string;
  bodyType?:     BodyType;
  fuel?:         Fuel;
  transmission?: Transmission;
  drivetrain?:   Drivetrain;
  engineCc?:     number;
  horsepower?:   number;
}

export type DecoderSource = "nhtsa" | "cache" | "manual";

export interface DecodeResult {
  decoded: boolean;           // true iff at least year+make+model were found
  source:  DecoderSource;
  vin:     string;            // echoed back, uppercased
  fields:  DecodedVehicle;    // ready for setValue()
  raw?:    unknown;           // upstream payload — only for diagnostics in dev
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function decodeVin(rawVin: string): Promise<DecodeResult> {
  const vin = normalizeVin(rawVin);
  if (vin.length < 11 || vin.length > 20) {
    return { decoded: false, source: "manual", vin, fields: {} };
  }

  // 1. Cache. Same VIN twice = no extra network call.
  const cached = await readCache(vin);
  if (cached) return { ...cached, source: "cache" };

  // 2. NHTSA primary fetch.
  const nhtsa = await fetchNhtsa(vin);
  if (nhtsa.fields && Object.keys(nhtsa.fields).length > 0) {
    await writeCache(vin, "nhtsa", nhtsa.fields, nhtsa.raw);
    const decoded = !!(nhtsa.fields.year && nhtsa.fields.make && nhtsa.fields.model);
    return { decoded, source: "nhtsa", vin, fields: nhtsa.fields, raw: nhtsa.raw };
  }

  // 3. (Future) try JDM-specialised provider here. Return no-match for now.
  return { decoded: false, source: "manual", vin, fields: {} };
}

// ─── VIN normalisation ──────────────────────────────────────────────────────

function normalizeVin(s: string): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── NHTSA fetch + map ──────────────────────────────────────────────────────

interface NhtsaResult { Variable: string; Value: string | null }

async function fetchNhtsa(vin: string): Promise<{ fields: DecodedVehicle; raw: unknown }> {
  try {
    const res = await fetch(`${NHTSA_URL}/${encodeURIComponent(vin)}?format=json`, {
      // Short timeout — slow decoders shouldn't gate the form.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { fields: {}, raw: { error: `nhtsa http ${res.status}` } };
    const json = await res.json();
    const results: NhtsaResult[] = json?.Results ?? [];
    return { fields: mapNhtsa(results), raw: json };
  } catch (err) {
    return { fields: {}, raw: { error: err instanceof Error ? err.message : String(err) } };
  }
}

/**
 * Translate NHTSA's variable/value pairs into our Specifications-compatible
 * shape. NHTSA returns strings, often empty or "Not Applicable" — we treat
 * everything non-truthy as missing.
 */
function mapNhtsa(results: NhtsaResult[]): DecodedVehicle {
  const get = (name: string): string | undefined => {
    const v = results.find((r) => r.Variable === name)?.Value;
    if (!v) return undefined;
    const trimmed = v.trim();
    if (!trimmed || trimmed === "Not Applicable" || trimmed === "0") return undefined;
    return trimmed;
  };

  const out: DecodedVehicle = {};

  const year = get("Model Year");
  if (year && /^\d{4}$/.test(year)) out.year = Number(year);

  const make = get("Make");
  if (make) out.make = titleCase(make);

  const model = get("Model");
  if (model) out.model = model;

  const trim = get("Trim") ?? get("Series");
  if (trim) out.trim = trim;

  const bodyClass = get("Body Class");
  if (bodyClass) {
    const mapped = mapBodyClass(bodyClass);
    if (mapped) out.bodyType = mapped;
  }

  const fuel = get("Fuel Type - Primary");
  if (fuel) {
    const mapped = mapFuel(fuel);
    if (mapped) out.fuel = mapped;
  }

  const trans = get("Transmission Style");
  if (trans) {
    const mapped = mapTransmission(trans);
    if (mapped) out.transmission = mapped;
  }

  const drive = get("Drive Type");
  if (drive) {
    const mapped = mapDrivetrain(drive);
    if (mapped) out.drivetrain = mapped;
  }

  // Prefer CC; fall back to L * 1000.
  const cc = get("Displacement (CC)");
  if (cc && /^\d+(\.\d+)?$/.test(cc)) {
    const n = Math.round(Number(cc));
    if (n >= 50 && n <= 20_000) out.engineCc = n;
  } else {
    const liters = get("Displacement (L)");
    if (liters && /^\d+(\.\d+)?$/.test(liters)) {
      const n = Math.round(Number(liters) * 1000);
      if (n >= 50 && n <= 20_000) out.engineCc = n;
    }
  }

  // NHTSA gives a range; take the lower bound (more honest for sellers).
  const hpFrom = get("Engine Brake (hp) From");
  const hpTo   = get("Engine Brake (hp) To");
  const hpRaw  = hpFrom ?? hpTo;
  if (hpRaw && /^\d+(\.\d+)?$/.test(hpRaw)) {
    const n = Math.round(Number(hpRaw));
    if (n >= 20 && n <= 2_500) out.horsepower = n;
  }

  return out;
}

// ─── Value mappers ──────────────────────────────────────────────────────────

function mapBodyClass(s: string): BodyType | undefined {
  const v = s.toLowerCase();
  if (v.includes("sport utility") || v.includes("suv") || v.includes("multi-purpose")) return "suv";
  if (v.includes("sedan") || v.includes("saloon")) return "sedan";
  if (v.includes("hatchback") || v.includes("liftback") || v.includes("notchback")) return "hatchback";
  if (v.includes("pickup")) return "pickup";
  if (v.includes("coupe")) return "coupe";
  if (v.includes("wagon")) return "wagon";
  if (v.includes("van")) return "van";
  return undefined;
}

function mapFuel(s: string): Fuel | undefined {
  const v = s.toLowerCase();
  if (v.includes("electric") && !v.includes("hybrid")) return "electric";
  if (v.includes("hybrid") || v.includes("plug-in")) return "hybrid";
  if (v.includes("diesel")) return "diesel";
  if (v.includes("gasoline") || v.includes("petrol") || v.includes("ethanol")) return "petrol";
  return undefined;
}

function mapTransmission(s: string): Transmission | undefined {
  const v = s.toLowerCase();
  // CVT + Automated Manual count as auto for our purposes — buyers don't
  // shift them. Pure manual only matches "manual" with no other qualifier.
  if (v.includes("manual") && !v.includes("automated")) return "manual";
  if (v.includes("automatic") || v.includes("cvt") || v.includes("automated") || v.includes("dual-clutch")) return "auto";
  return undefined;
}

function mapDrivetrain(s: string): Drivetrain | undefined {
  const v = s.toLowerCase();
  if (v.includes("4wd") || v.includes("four-wheel") || v.includes("4x4")) return "4wd";
  if (v.includes("awd") || v.includes("all-wheel")) return "awd";
  if (v.includes("rwd") || v.includes("rear-wheel")) return "rwd";
  if (v.includes("fwd") || v.includes("front-wheel")) return "fwd";
  return undefined;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w)
    .join(" ");
}

// ─── Cache I/O ──────────────────────────────────────────────────────────────

async function readCache(vin: string): Promise<DecodeResult | null> {
  try {
    const rows = await query<{ source: string; fields: DecodedVehicle; raw: unknown }>(
      `SELECT source, fields, raw FROM vin_cache WHERE vin = $1 LIMIT 1`,
      [vin],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const decoded = !!(r.fields?.year && r.fields?.make && r.fields?.model);
    return { decoded, source: r.source as DecoderSource, vin, fields: r.fields ?? {}, raw: r.raw };
  } catch {
    // Cache miss should never block the user.
    return null;
  }
}

async function writeCache(
  vin: string,
  source: DecoderSource,
  fields: DecodedVehicle,
  raw: unknown,
): Promise<void> {
  try {
    await query(
      `INSERT INTO vin_cache (vin, source, fields, raw)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (vin) DO UPDATE SET
         source     = EXCLUDED.source,
         fields     = EXCLUDED.fields,
         raw        = EXCLUDED.raw,
         decoded_at = NOW()`,
      [vin, source, JSON.stringify(fields), JSON.stringify(raw)],
    );
  } catch {
    // Non-blocking — caller still gets the decoded result.
  }
}
