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

export type DecoderSource = "nhtsa" | "wmi" | "cache" | "manual";

export type Confidence = "high" | "medium" | "low";

export interface DecodeResult {
  decoded: boolean;           // true iff at least year+make+model were found
  source:  DecoderSource;
  vin:     string;            // echoed back, uppercased
  fields:  DecodedVehicle;    // ready for setValue()
  // Per-field confidence so the UI can flag low-confidence values for review
  // instead of presenting everything as equally certain.
  confidence: Partial<Record<keyof DecodedVehicle, Confidence>>;
  // Human labels of important fields we could NOT determine — the form asks
  // the seller to fill these rather than us guessing.
  couldNotDetermine: string[];
  isEv:    boolean;           // electric — never claim engine displacement
  country?: string;           // derived from the VIN's first character (WMI)
  raw?:    unknown;           // upstream payload — only for diagnostics in dev
}

// ─── Public entry point ─────────────────────────────────────────────────────
//
// Decode order: cache → NHTSA → (always) manufacturer (WMI) rules. The WMI
// layer is local and free, so it runs on EVERY decode to fill make / country
// / year even when NHTSA returns nothing (the common case for JDM and other
// non-US-spec imports). We never fabricate a field we can't source — anything
// missing is reported in `couldNotDetermine` for the seller to confirm.

export async function decodeVin(rawVin: string): Promise<DecodeResult> {
  const vin = normalizeVin(rawVin);
  if (vin.length < 11 || vin.length > 20) {
    return finalize(vin, {}, "manual", undefined);
  }

  // 1. Cache. Same VIN twice = no extra network call.
  const cached = await readCache(vin);
  if (cached) return finalize(vin, cached.fields, "cache", cached.raw);

  // 2. NHTSA primary fetch.
  const nhtsa = await fetchNhtsa(vin);
  if (nhtsa.fields && Object.keys(nhtsa.fields).length > 0) {
    await writeCache(vin, "nhtsa", nhtsa.fields, nhtsa.raw);
    return finalize(vin, nhtsa.fields, "nhtsa", nhtsa.raw);
  }

  // 3. NHTSA had nothing — the WMI layer inside finalize still fills make /
  //    country / year for non-US imports.
  return finalize(vin, {}, "manual", nhtsa.raw);
}

// ─── Finalize: merge WMI, score confidence, report gaps ─────────────────────

const BASE_CONFIDENCE: Partial<Record<keyof DecodedVehicle, Confidence>> = {
  year: "high", make: "high", model: "medium", trim: "low",
  bodyType: "medium", fuel: "medium", transmission: "medium",
  drivetrain: "medium", engineCc: "medium", horsepower: "low",
};

function finalize(
  vin: string, base: DecodedVehicle, baseSource: DecoderSource, raw: unknown,
): DecodeResult {
  const wmi = decodeWmi(vin);
  const fields: DecodedVehicle = { ...base };
  const confidence: Partial<Record<keyof DecodedVehicle, Confidence>> = {};
  for (const k of Object.keys(base) as (keyof DecodedVehicle)[]) {
    confidence[k] = BASE_CONFIDENCE[k] ?? "medium";
  }

  // Manufacturer rules backfill make / year when the primary source missed
  // them — high confidence for make (WMI is deterministic), medium for the
  // position-10 year code.
  if (!fields.make && wmi.make)  { fields.make = wmi.make; confidence.make = "high"; }
  if (!fields.year && wmi.year)  { fields.year = wmi.year; confidence.year = "medium"; }

  // Electric: trust the WMI EV flag or an explicit electric fuel. Never keep
  // an engine displacement on an EV — ask for variant/battery instead.
  const isEv = wmi.ev || base.fuel === "electric";
  if (isEv) {
    fields.fuel = "electric";
    confidence.fuel = wmi.ev ? "high" : (confidence.fuel ?? "medium");
    delete fields.engineCc;
    delete confidence.engineCc;
  }

  const couldNotDetermine = missingImportant(fields, isEv);
  const hasBase = Object.keys(base).length > 0;
  const source: DecoderSource = hasBase
    ? baseSource
    : (wmi.make || wmi.year) ? "wmi" : "manual";
  const decoded = !!(fields.year && fields.make && fields.model);

  return {
    decoded, source, vin, fields, confidence, couldNotDetermine,
    isEv, country: wmi.country, raw,
  };
}

// Important, form-facing fields the seller still needs to confirm.
function missingImportant(f: DecodedVehicle, isEv: boolean): string[] {
  const out: string[] = [];
  if (!f.model)        out.push("Model");
  if (!f.trim)         out.push("Trim");
  if (!f.bodyType)     out.push("Body type");
  if (!f.fuel)         out.push("Fuel");
  if (!f.transmission) out.push("Transmission");
  if (isEv)            out.push("Battery / variant");
  else if (!f.engineCc) out.push("Engine size");
  return out;
}

// ─── VIN normalisation ──────────────────────────────────────────────────────

function normalizeVin(s: string): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Manufacturer (WMI) rules ───────────────────────────────────────────────
// The first 3 chars (World Manufacturer Identifier) deterministically encode
// the maker; the 1st char encodes the country/region; position 10 encodes the
// model year. This local layer covers the Kenya-market mix (JDM, UK, EU, EV)
// that the US-centric NHTSA database typically can't.

interface WmiInfo { make: string; ev?: boolean }

// Specific 3-char WMIs (checked first).
const WMI_3: Record<string, WmiInfo> = {
  JTH: { make: "Lexus" }, "2T2": { make: "Lexus" }, "58A": { make: "Lexus" },
  JA3: { make: "Mitsubishi" }, JA4: { make: "Mitsubishi" }, JMB: { make: "Mitsubishi" }, JMY: { make: "Mitsubishi" },
  JAA: { make: "Isuzu" }, JAB: { make: "Isuzu" }, JAC: { make: "Isuzu" }, JAL: { make: "Isuzu" }, MPA: { make: "Isuzu" },
  MA3: { make: "Suzuki" }, TSM: { make: "Suzuki" },
  SAL: { make: "Land Rover" }, SAJ: { make: "Jaguar" },
  WF0: { make: "Ford" }, MAJ: { make: "Ford" }, "6FP": { make: "Ford" },
  VF3: { make: "Peugeot" }, VF7: { make: "Citroen" }, VF1: { make: "Renault" },
  "5YJ": { make: "Tesla", ev: true }, "7SA": { make: "Tesla", ev: true },
  LRW: { make: "Tesla", ev: true }, XP7: { make: "Tesla", ev: true }, SFZ: { make: "Tesla", ev: true },
  WP0: { make: "Porsche" }, WP1: { make: "Porsche" },
  TRU: { make: "Audi" }, "93U": { make: "Audi" },
};

// 2-char fallback when the exact WMI isn't listed (covers a maker's many WMIs).
const WMI_2: Record<string, string> = {
  JT: "Toyota", SB: "Toyota", MR: "Toyota", NM: "Toyota",
  JN: "Nissan", SJ: "Nissan", VS: "Nissan",
  JM: "Mazda", JH: "Honda", SH: "Honda",
  JF: "Subaru", JS: "Suzuki",
  KM: "Hyundai", KN: "Kia",
  WD: "Mercedes-Benz", W1: "Mercedes-Benz",
  WB: "BMW", WA: "Audi", WV: "Volkswagen", WU: "Audi",
  YV: "Volvo", ZF: "Fiat", ZA: "Alfa Romeo",
};

// Country/region from the first VIN character.
const COUNTRY_BY_FIRST: Record<string, string> = {
  J: "Japan", K: "South Korea", L: "China", M: "India / Asia", N: "Turkey / Asia",
  S: "United Kingdom / Europe", T: "Europe", V: "France / Spain", W: "Germany",
  X: "Russia / Europe", Y: "Sweden / Europe", Z: "Italy",
  "1": "United States", "4": "United States", "5": "United States",
  "2": "Canada", "3": "Mexico", "6": "Australia", "9": "Brazil",
};

interface WmiDecode { make?: string; ev?: boolean; country?: string; year?: number }

function decodeWmi(vin: string): WmiDecode {
  const out: WmiDecode = {};
  if (vin.length >= 1) out.country = COUNTRY_BY_FIRST[vin[0]];
  if (vin.length >= 3) {
    const three = WMI_3[vin.slice(0, 3)];
    if (three) { out.make = three.make; out.ev = three.ev; }
    else {
      const two = WMI_2[vin.slice(0, 2)];
      if (two) out.make = two;
    }
  }
  if (vin.length >= 10) {
    const y = yearFromCode(vin[9]);
    if (y) out.year = y;
  }
  return out;
}

// Position-10 model-year code. Letters → 2010–2030, digits 1–9 → 2001–2009
// (the digit branch repeats at 2031+, but that's future-dated, so for a
// marketplace today a digit unambiguously means 2001–2009). I/O/Q/U/Z/0 are
// never used in this position.
const YEAR_LETTERS = "ABCDEFGHJKLMNPRSTVWXY"; // 2010..2030
function yearFromCode(code: string): number | undefined {
  const i = YEAR_LETTERS.indexOf(code);
  if (i >= 0) return 2010 + i;
  if (/^[1-9]$/.test(code)) return 2000 + Number(code); // 2001–2009
  return undefined;
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

async function readCache(vin: string): Promise<{ fields: DecodedVehicle; raw: unknown } | null> {
  try {
    const rows = await query<{ fields: DecodedVehicle; raw: unknown }>(
      `SELECT fields, raw FROM vin_cache WHERE vin = $1 LIMIT 1`,
      [vin],
    );
    if (rows.length === 0) return null;
    return { fields: rows[0].fields ?? {}, raw: rows[0].raw };
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
