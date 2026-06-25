import type { Car } from "@/types";
import { expandAliases } from "@/lib/search-aliases";
import { getCentroid, haversineKm } from "@/lib/locations";
import { isVisibleUnderPolicy } from "@/lib/quality-policy";

// Shared search types + static filter/facet logic for /api/cars/search.
// The DB path lives in lib/db.ts → searchCarsDb. Both paths return the
// same SearchResponse shape so the route handler can pick either.

export type SortKey =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "mileage_asc"
  | "year_desc"
  | "featured"
  | "trust";

export interface SearchFilters {
  q?: string;
  makes?: string[];          // make slugs (lowercase) OR display names — both accepted
  models?: string[];         // model slugs OR display names
  bodyTypes?: string[];
  fuels?: string[];
  locations?: string[];
  conditions?: string[];     // brief allows multi (e.g. new + certified)
  transmissions?: string[];
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  financing?: boolean;
  hirePurchase?: boolean;
  verifiedOnly?: boolean;
  // PR4: advanced filters
  drivetrains?: string[];
  exteriorColors?: string[];
  interiorColors?: string[];
  sellerTypes?: string[];
  minEngineSize?: number;
  maxEngineSize?: number;
  maxOwners?: number;
  // PR5: radius. Applies only when exactly one entry is in `locations` —
  // that entry is the centre; radiusKm is the distance bound (0 = disabled).
  radiusKm?: number;
  // PR6: trust filters + market-price band.
  trustInspection?:     boolean;
  trustService?:        boolean;
  trustOwnership?:      boolean;
  trustVin?:            boolean;
  trustBelowMarket?:    boolean;
  // 2026-06-22 trust fields.
  trustMileageVerified?: boolean;
  trustLogbookVerified?: boolean;
  accidentHistories?:    string[]; // ANY-OF semantics; UI exposes "Accident-free only"
  sort?: SortKey;
  page?: number;
  limit?: number;
}

export interface FacetBucket {
  value: string;
  label?: string;
  count: number;
}

export interface SearchFacets {
  makes:         FacetBucket[];
  bodyTypes:     FacetBucket[];
  fuels:         FacetBucket[];
  conditions:    FacetBucket[];
  locations:     FacetBucket[];
  transmissions: FacetBucket[];
  // PR4: advanced facets
  drivetrains:    FacetBucket[];
  exteriorColors: FacetBucket[];
  sellerTypes:    FacetBucket[];
}

export interface SearchResponse {
  cars:       Car[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  facets:     SearchFacets;
  source:     "db" | "static";
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT     = 50;

export function parseSearchParams(sp: URLSearchParams): SearchFilters {
  const num = (k: string): number | undefined => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const list = (k: string): string[] | undefined => {
    const all = sp.getAll(k).filter(Boolean);
    return all.length ? all : undefined;
  };
  const bool = (k: string): boolean | undefined => {
    const v = sp.get(k);
    if (v === null) return undefined;
    return v === "1" || v === "true";
  };

  const limit = Math.min(num("limit") ?? DEFAULT_LIMIT, MAX_LIMIT);
  const page  = Math.max(num("page") ?? 1, 1);

  // Single-value conditions can also come through; normalize to array.
  const conditionsList = list("condition");

  return {
    q:             sp.get("q") || undefined,
    makes:         list("make"),
    models:        list("model"),
    bodyTypes:     list("body"),
    fuels:         list("fuel"),
    locations:     list("location"),
    conditions:    conditionsList,
    transmissions: list("transmission"),
    minPrice:      num("min_price"),
    maxPrice:      num("max_price"),
    minYear:       num("min_year"),
    maxYear:       num("max_year"),
    minMileage:    num("min_mileage"),
    maxMileage:    num("max_mileage"),
    financing:     bool("financing"),
    hirePurchase:  bool("hire_purchase"),
    verifiedOnly:  bool("verified"),
    // PR4
    drivetrains:    list("drivetrain"),
    exteriorColors: list("ext_color"),
    interiorColors: list("int_color"),
    sellerTypes:    list("seller_type"),
    minEngineSize:  num("min_engine"),
    maxEngineSize:  num("max_engine"),
    maxOwners:      num("max_owners"),
    // PR5
    radiusKm:       num("radius"),
    // PR6
    trustInspection:  bool("trust_inspection"),
    trustService:     bool("trust_service"),
    trustOwnership:   bool("trust_ownership"),
    trustVin:         bool("trust_vin"),
    trustBelowMarket: bool("trust_below_market"),
    // 2026-06-22
    trustMileageVerified: bool("trust_mileage"),
    trustLogbookVerified: bool("trust_logbook"),
    accidentHistories:    list("accident_history"),
    sort:           (sp.get("sort") as SortKey) || "newest",
    page,
    limit,
  };
}

// ── Static-path filter + facet logic ────────────────────────────────────────

function matchesText(car: Car, q: string): boolean {
  const hay = `${car.year} ${car.make} ${car.model} ${car.trim ?? ""} ${car.description} ${car.location} ${car.dealer.name}`
    .toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inSet(value: string, set: string[]): boolean {
  // Accept both display names ("Toyota") and slugs ("toyota").
  const v  = value.toLowerCase();
  const sl = slugify(value);
  return set.some((s) => {
    const t = s.toLowerCase();
    return t === v || t === sl;
  });
}

type ExcludeDim =
  | "make" | "model" | "body" | "fuel" | "condition" | "transmission" | "location"
  | "drivetrain" | "exterior_color" | "seller_type";

function applyFilters(cars: Car[], f: SearchFilters, exclude?: ExcludeDim): Car[] {
  return cars.filter((c) => {
    // Quality policy gate (Option A) — applied to every public search path,
    // including independent-facet computation. Grandfathers pre-cutoff rows.
    if (!isVisibleUnderPolicy({ createdAt: c.createdAt, photoCount: c.images?.length ?? 0, vin: c.vin })) return false;
    if (f.q && !matchesText(c, f.q)) return false;
    if (exclude !== "make"           && f.makes?.length          && !inSet(c.make, f.makes)) return false;
    if (exclude !== "model"          && f.models?.length         && !inSet(c.model, f.models)) return false;
    if (exclude !== "body"           && f.bodyTypes?.length      && !inSet(c.bodyType, f.bodyTypes)) return false;
    if (exclude !== "fuel"           && f.fuels?.length          && !inSet(c.fuel, f.fuels)) return false;
    if (exclude !== "location"       && f.locations?.length      && !inSet(c.location, f.locations)) return false;
    if (exclude !== "condition"      && f.conditions?.length     && !inSet(c.condition, f.conditions)) return false;
    if (exclude !== "transmission"   && f.transmissions?.length  && !inSet(c.transmission, f.transmissions)) return false;
    if (exclude !== "drivetrain"     && f.drivetrains?.length    && (!c.drivetrain    || !inSet(c.drivetrain,    f.drivetrains))) return false;
    if (exclude !== "exterior_color" && f.exteriorColors?.length && (!c.exteriorColor || !inSet(c.exteriorColor, f.exteriorColors))) return false;
    if (exclude !== "seller_type"    && f.sellerTypes?.length    && (!c.sellerType    || !inSet(c.sellerType,    f.sellerTypes))) return false;
    if (f.interiorColors?.length && (!c.interiorColor || !inSet(c.interiorColor, f.interiorColors))) return false;
    if (f.minPrice   !== undefined && c.price   <  f.minPrice)   return false;
    if (f.maxPrice   !== undefined && c.price   >  f.maxPrice)   return false;
    if (f.minYear    !== undefined && c.year    <  f.minYear)    return false;
    if (f.maxYear    !== undefined && c.year    >  f.maxYear)    return false;
    if (f.minMileage !== undefined && c.mileage <  f.minMileage) return false;
    if (f.maxMileage !== undefined && c.mileage >  f.maxMileage) return false;
    if (f.minEngineSize !== undefined && (c.engineSizeL === undefined || c.engineSizeL < f.minEngineSize)) return false;
    if (f.maxEngineSize !== undefined && (c.engineSizeL === undefined || c.engineSizeL > f.maxEngineSize)) return false;
    if (f.maxOwners     !== undefined && (c.previousOwners === undefined || c.previousOwners > f.maxOwners)) return false;
    // PR5: radius — applies only when exactly ONE location is chosen and radius > 0.
    // Static cars have no lat/lng on the type, so we look up centroids by name.
    if (f.radiusKm && f.radiusKm > 0 && f.locations?.length === 1) {
      const origin = getCentroid(f.locations[0]);
      const here   = getCentroid(c.location);
      if (!origin || !here) return false;
      if (haversineKm(origin.lat, origin.lng, here.lat, here.lng) > f.radiusKm) return false;
    }
    // PR6: trust filters. trustBelowMarket is applied separately (needs the
    // baseline computed by computePriceTier).
    if (f.trustInspection && !c.inspectionAvailable)        return false;
    if (f.trustService    && !c.serviceHistoryAvailable)    return false;
    if (f.trustOwnership  && !c.ownershipVerified)          return false;
    if (f.trustVin        && !c.vinVerified)                return false;
    // 2026-06-22 trust fields.
    if (f.trustMileageVerified && !c.mileageVerified)       return false;
    if (f.trustLogbookVerified && !c.logbookVerified)       return false;
    if (f.accidentHistories?.length && (!c.accidentHistory || !f.accidentHistories.includes(c.accidentHistory))) return false;
    if (f.financing    && !c.financingAvailable) return false;
    if (f.hirePurchase && !c.hirePurchaseAvailable) return false;
    if (f.verifiedOnly && !c.verified) return false;
    return true;
  });
}

// PR6 price-tier classifier. Looks at active cars with the same make+model
// and similar year (±1) as the candidate, computes an average price, and
// labels great/fair/above. Requires at least 3 comparable listings to avoid
// classifying off a sample of one.
const GREAT_DEAL_THRESHOLD = 0.92;   // <= 92% of avg
const ABOVE_MARKET_THRESHOLD = 1.08; // >= 108% of avg
const MIN_COMPARABLES        = 3;

function computeMarketBaseline(car: Car, pool: Car[]): { avg: number; count: number } | null {
  const sample = pool.filter((p) =>
    p.id !== car.id
    && p.make === car.make
    && p.model === car.model
    && Math.abs(p.year - car.year) <= 1,
  );
  if (sample.length < MIN_COMPARABLES) return null;
  const avg = sample.reduce((s, c) => s + c.price, 0) / sample.length;
  return { avg, count: sample.length };
}

function classify(price: number, avg: number): "great" | "fair" | "above" {
  if (price <= avg * GREAT_DEAL_THRESHOLD) return "great";
  if (price >= avg * ABOVE_MARKET_THRESHOLD) return "above";
  return "fair";
}

function enrichWithPriceTier(cars: Car[], pool: Car[]): Car[] {
  return cars.map((c) => {
    const baseline = computeMarketBaseline(c, pool);
    if (!baseline) return c;
    return {
      ...c,
      marketAvg:         Math.round(baseline.avg),
      marketSampleCount: baseline.count,
      priceTier:         classify(c.price, baseline.avg),
    };
  });
}

function applySort(cars: Car[], sort: SortKey | undefined): Car[] {
  const arr = [...cars];
  switch (sort) {
    case "price_asc":   arr.sort((a, b) => a.price - b.price); break;
    case "price_desc":  arr.sort((a, b) => b.price - a.price); break;
    case "mileage_asc": arr.sort((a, b) => a.mileage - b.mileage); break;
    case "year_desc":   arr.sort((a, b) => b.year - a.year); break;
    case "trust":
      // Highest-trust first: dealer score, then rating, then recency.
      arr.sort((a, b) =>
        (b.dealer.score ?? -1) - (a.dealer.score ?? -1)
        || (b.dealer.rating ?? 0) - (a.dealer.rating ?? 0)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "featured":
      arr.sort((a, b) => Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "newest":
    default:
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return arr;
}

function bucketize(cars: Car[], key: (c: Car) => string): FacetBucket[] {
  const map = new Map<string, number>();
  for (const c of cars) {
    const k = key(c);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

// Independent facets (PR3c): each dimension's count comes from a result set
// that excludes its own filter. So picking Toyota in Makes still shows the
// other makes that would match if Toyota were unselected.
function computeIndependentFacets(allCars: Car[], filters: SearchFilters): SearchFacets {
  return {
    makes:          bucketize(applyFilters(allCars, filters, "make"),           (c) => c.make),
    bodyTypes:      bucketize(applyFilters(allCars, filters, "body"),           (c) => c.bodyType),
    fuels:          bucketize(applyFilters(allCars, filters, "fuel"),           (c) => c.fuel),
    conditions:     bucketize(applyFilters(allCars, filters, "condition"),      (c) => c.condition),
    locations:      bucketize(applyFilters(allCars, filters, "location"),       (c) => c.location),
    transmissions:  bucketize(applyFilters(allCars, filters, "transmission"),   (c) => c.transmission),
    drivetrains:    bucketize(applyFilters(allCars, filters, "drivetrain"),     (c) => c.drivetrain ?? ""),
    exteriorColors: bucketize(applyFilters(allCars, filters, "exterior_color"), (c) => c.exteriorColor ?? ""),
    sellerTypes:    bucketize(applyFilters(allCars, filters, "seller_type"),    (c) => c.sellerType ?? ""),
  };
}

export function searchCarsStatic(allCars: Car[], filters: SearchFilters): SearchResponse {
  // Expand Kenya-market aliases so free-text "benz" still matches the static
  // car set where make is stored as "Mercedes-Benz".
  const effective: SearchFilters = filters.q
    ? { ...filters, q: expandAliases(filters.q).expanded }
    : filters;

  let filtered = applyFilters(allCars, effective);

  // PR6: below-market filter. Compute the tier first, then drop non-great rows.
  if (effective.trustBelowMarket) {
    filtered = filtered.filter((c) => {
      const baseline = computeMarketBaseline(c, allCars);
      if (!baseline) return false;
      return c.price <= baseline.avg * GREAT_DEAL_THRESHOLD;
    });
  }

  const sorted   = applySort(filtered, effective.sort);
  const total    = sorted.length;
  const limit    = effective.limit ?? DEFAULT_LIMIT;
  const page     = effective.page ?? 1;
  const start    = (page - 1) * limit;
  const pageCars = sorted.slice(start, start + limit);

  // Enrich just the page slice with marketAvg + priceTier so the UI can show
  // chips. Baseline pool is the full active set, not the filtered subset.
  const cars = enrichWithPriceTier(pageCars, allCars);

  return {
    cars,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    facets:     computeIndependentFacets(allCars, effective),
    source:     "static",
  };
}
