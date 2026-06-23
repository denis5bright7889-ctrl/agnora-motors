"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CarCard } from "@/components/car-card";
import { SkeletonCard } from "@/components/skeleton-card";
import {
  SlidersHorizontal, X, ChevronDown, Search, BookmarkPlus,
  CheckIcon, Heart, Clock, ChevronRight, Banknote, Loader2,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useWishlist } from "@/lib/store";
import { getRecentlyViewedIds } from "@/lib/store";
import type { Car } from "@/types";
import type { SearchResponse, FacetBucket } from "@/lib/search";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { MobileSearchTrigger } from "@/components/mobile-search-overlay";
import { RADIUS_OPTIONS } from "@/lib/locations";

const MAKES = [
  "Toyota","Mazda","Nissan","Mercedes-Benz","Honda","BMW",
  "Subaru","Mitsubishi","Isuzu","Land Rover","Ford","Volkswagen",
  "Hyundai","Kia","Lexus","Audi","Peugeot",
];
const BODY_TYPES = ["suv","sedan","hatchback","pickup","coupe","wagon","van"];
const FUELS = ["petrol","diesel","hybrid","electric"];
const LOCATIONS = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika"];
const CONDITIONS = [
  { value: "all",           label: "All" },
  { value: "new",           label: "New" },
  { value: "foreign_used",  label: "Foreign Used" },
  { value: "locally_used",  label: "Locally Used" },
  { value: "certified",     label: "Certified" },
];
// PR4: advanced filter options.
const DRIVETRAINS = [
  { value: "fwd", label: "FWD" },
  { value: "rwd", label: "RWD" },
  { value: "awd", label: "AWD" },
  { value: "4wd", label: "4WD" },
];
const EXTERIOR_COLORS = [
  "Black","White","Silver","Gray","Red","Blue","Green","Beige","Brown","Yellow",
];
const SELLER_TYPES = [
  { value: "dealer",     label: "Dealer" },
  { value: "private",    label: "Private seller" },
  { value: "login_free", label: "Quick listing" },
];
const SORT_OPTIONS = [
  { value: "newest",     label: "Newest first" },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "mileage_asc",label: "Lowest mileage" },
  { value: "year_desc",  label: "Newest year" },
];

const STAGGER = [
  "", "[animation-delay:40ms]", "[animation-delay:80ms]", "[animation-delay:120ms]",
  "[animation-delay:160ms]", "[animation-delay:200ms]", "[animation-delay:240ms]",
  "[animation-delay:280ms]", "[animation-delay:320ms]", "[animation-delay:360ms]",
  "[animation-delay:400ms]", "[animation-delay:440ms]",
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Lookup a facet count by raw value or slug equivalence.
function countFor(buckets: FacetBucket[] | undefined, value: string): number {
  if (!buckets) return 0;
  const v  = value.toLowerCase();
  const sl = slugify(value);
  const hit = buckets.find((b) => {
    const t = b.value.toLowerCase();
    return t === v || t === sl;
  });
  return hit?.count ?? 0;
}

interface Props {
  initial: SearchResponse;
}

// Batch ID resolution via /api/cars?ids=... (PR3d).
// Replaces the previous static-only lookup so wishlist + recently-viewed
// work against real dealer-uploaded cars from the DB. Server falls back to
// the static set for IDs it can't resolve; order is preserved.
function useCarsByIds(ids: string[]): Car[] {
  const [cars, setCars] = useState<Car[]>([]);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) { setCars([]); return; }
    let cancelled = false;
    fetch(`/api/cars?ids=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data: { cars?: Car[] }) => { if (!cancelled) setCars(data.cars ?? []); })
      .catch(() => { /* silent — these features must never break */ });
    return () => { cancelled = true; };
    // ids array is stable per key — see eslint disable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return cars;
}

function useRecentlyViewedCars(): Car[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(getRecentlyViewedIds()); }, []);
  return useCarsByIds(ids);
}

function CarsListingInner({ initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [data, setData]       = useState<SearchResponse>(initial);
  const [loading, setLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [saveToast, setSaveToast]         = useState(false);
  const [showWishlist, setShowWishlist]   = useState(false);
  const [priceMin, setPriceMin]           = useState(() => params.get("min_price")   ?? "");
  const [priceMax, setPriceMax]           = useState(() => params.get("max_price")   ?? "");
  const [yearMin,  setYearMin]            = useState(() => params.get("min_year")    ?? "");
  const [yearMax,  setYearMax]            = useState(() => params.get("max_year")    ?? "");
  const [mileageMin, setMileageMin]       = useState(() => params.get("min_mileage") ?? "");
  const [mileageMax, setMileageMax]       = useState(() => params.get("max_mileage") ?? "");
  const [localQ, setLocalQ]               = useState(() => params.get("q") ?? "");
  const [localModel, setLocalModel]       = useState(() => params.get("smodel") ?? "");

  const { ids: wishlistIds } = useWishlist();
  const recentlyViewed = useRecentlyViewedCars();

  function get(key: string)    { return params.get(key) ?? ""; }
  function getAll(key: string) { return params.getAll(key); }

  const condition         = get("condition");
  const selectedMakes     = getAll("make");
  const selectedBodies    = getAll("body");
  const selectedFuels     = getAll("fuel");
  const selectedLocations = getAll("location");
  const selectedDrives    = getAll("drivetrain");
  const selectedColors    = getAll("ext_color");
  const selectedSellers   = getAll("seller_type");
  const transmission      = get("transmission");
  const sort              = get("sort") || "newest";
  const page              = Math.max(1, Number(get("page") || "1"));
  const searchMake        = get("smake");
  const financing         = get("financing")     === "1";
  const hirePurchase      = get("hire_purchase") === "1";
  const radiusKm          = Number(get("radius") || "0");
  const radiusUsable      = selectedLocations.length === 1;
  const trustVerified         = get("verified")           === "1";
  const trustInspection       = get("trust_inspection")   === "1";
  const trustService          = get("trust_service")      === "1";
  const trustOwnership        = get("trust_ownership")    === "1";
  const trustVin              = get("trust_vin")          === "1";
  const trustMileageVerified  = get("trust_mileage")      === "1";
  const trustLogbookVerified  = get("trust_logbook")      === "1";
  const selectedAccidents     = getAll("accident_history");
  const accidentFreeOnly      = selectedAccidents.includes("none") && selectedAccidents.length === 1;

  // Quick vs Advanced filter split — Tier 1 quick filters always visible,
  // Tier 2 collapsed behind a toggle. Auto-open when any advanced filter
  // is already active so users always see what's in effect.
  const hasAdvancedActive =
    selectedDrives.length  > 0 ||
    selectedColors.length  > 0 ||
    selectedSellers.length > 0 ||
    (radiusKm > 0 && radiusUsable) ||
    financing || hirePurchase ||
    trustVerified || trustInspection || trustService ||
    trustOwnership || trustVin ||
    trustMileageVerified || trustLogbookVerified ||
    selectedAccidents.length > 0;

  const [advancedOpen, setAdvancedOpen] = useState<boolean>(hasAdvancedActive);
  useEffect(() => {
    if (hasAdvancedActive) setAdvancedOpen(true);
  }, [hasAdvancedActive]);

  // Sync local text inputs → URL (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (localQ) next.set("q", localQ); else next.delete("q");
      next.delete("page");
      const target = next.toString();
      if (target !== paramsRef.current.toString()) {
        router.push(`?${target}`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (localModel) next.set("smodel", localModel); else next.delete("smodel");
      next.delete("page");
      const target = next.toString();
      if (target !== paramsRef.current.toString()) {
        router.push(`?${target}`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localModel]);

  // Refetch search results whenever URL params change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Fold the desktop free-text smake/smodel into the universal q so the
    // server search engine sees them — the server endpoint doesn't know about
    // smake/smodel as discrete filters.
    const sp = new URLSearchParams(params.toString());
    const extra: string[] = [];
    if (sp.get("smake"))  { extra.push(sp.get("smake")!);  sp.delete("smake"); }
    if (sp.get("smodel")) { extra.push(sp.get("smodel")!); sp.delete("smodel"); }
    if (extra.length) {
      const existing = sp.get("q") ?? "";
      sp.set("q", [existing, ...extra].filter(Boolean).join(" "));
    }

    fetch(`/api/cars/search?${sp}`)
      .then((r) => r.json())
      .then((d: SearchResponse) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`?${next}`, { scroll: false });
  }

  function toggleMulti(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const existing = next.getAll(key);
    next.delete(key);
    // Slug-tolerant equality: matches "Toyota" against "toyota" etc.
    const valueSlug = slugify(value);
    const isPresent = existing.some((v) => slugify(v) === valueSlug);
    if (isPresent) {
      existing.filter((v) => slugify(v) !== valueSlug).forEach((v) => next.append(key, v));
    } else {
      [...existing, value].forEach((v) => next.append(key, v));
    }
    next.delete("page");
    router.push(`?${next}`, { scroll: false });
  }

  function applyPriceRange() {
    const next = new URLSearchParams(params.toString());
    if (priceMin) next.set("min_price", priceMin); else next.delete("min_price");
    if (priceMax) next.set("max_price", priceMax); else next.delete("max_price");
    next.delete("page");
    router.push(`?${next}`, { scroll: false });
  }

  function applyYearRange() {
    const next = new URLSearchParams(params.toString());
    if (yearMin) next.set("min_year", yearMin); else next.delete("min_year");
    if (yearMax) next.set("max_year", yearMax); else next.delete("max_year");
    next.delete("page");
    router.push(`?${next}`, { scroll: false });
  }

  function applyMileageRange() {
    const next = new URLSearchParams(params.toString());
    if (mileageMin) next.set("min_mileage", mileageMin); else next.delete("min_mileage");
    if (mileageMax) next.set("max_mileage", mileageMax); else next.delete("max_mileage");
    next.delete("page");
    router.push(`?${next}`, { scroll: false });
  }

  function clearAll() {
    setLocalQ("");
    setLocalModel("");
    setPriceMin("");
    setPriceMax("");
    setYearMin("");
    setYearMax("");
    setMileageMin("");
    setMileageMax("");
    router.push("/cars", { scroll: false });
  }

  const isInSelected = (selected: string[], value: string) => {
    const vs = slugify(value);
    return selected.some((s) => slugify(s) === vs);
  };

  const wishlistIdsArray = useMemo(() => [...wishlistIds], [wishlistIds]);
  const wishlistCars     = useCarsByIds(wishlistIdsArray);

  const activeFilters: { label: string; clear: () => void }[] = [
    ...(condition && condition !== "all"
      ? [{ label: CONDITIONS.find((c) => c.value === condition)?.label ?? condition, clear: () => setParam("condition", null) }]
      : []),
    ...selectedMakes.map((m)     => ({ label: m, clear: () => toggleMulti("make", m) })),
    ...selectedBodies.map((b)    => ({ label: b, clear: () => toggleMulti("body", b) })),
    ...selectedFuels.map((f)     => ({ label: f, clear: () => toggleMulti("fuel", f) })),
    ...selectedLocations.map((l) => ({ label: l, clear: () => toggleMulti("location", l) })),
    ...selectedDrives.map((d)    => ({ label: (DRIVETRAINS.find((x) => x.value === d)?.label) ?? d.toUpperCase(), clear: () => toggleMulti("drivetrain", d) })),
    ...selectedColors.map((c)    => ({ label: c, clear: () => toggleMulti("ext_color", c) })),
    ...selectedSellers.map((s)   => ({ label: SELLER_TYPES.find((x) => x.value === s)?.label ?? s, clear: () => toggleMulti("seller_type", s) })),
    ...(transmission ? [{ label: transmission === "auto" ? "Automatic" : "Manual", clear: () => setParam("transmission", null) }] : []),
    ...(get("min_price") || get("max_price")
      ? [{
          label: `KSh ${get("min_price") ? formatPrice(Number(get("min_price"))) : "0"} – ${get("max_price") ? formatPrice(Number(get("max_price"))) : "any"}`,
          clear: () => { setParam("min_price", null); setParam("max_price", null); setPriceMin(""); setPriceMax(""); },
        }]
      : []),
    ...(get("min_year") || get("max_year")
      ? [{
          label: `Year ${get("min_year") || "any"} – ${get("max_year") || "any"}`,
          clear: () => { setParam("min_year", null); setParam("max_year", null); setYearMin(""); setYearMax(""); },
        }]
      : []),
    ...(get("min_mileage") || get("max_mileage")
      ? [{
          label: `Mileage ${get("min_mileage") ? Number(get("min_mileage")).toLocaleString() : "0"} – ${get("max_mileage") ? Number(get("max_mileage")).toLocaleString() + " km" : "any"}`,
          clear: () => { setParam("min_mileage", null); setParam("max_mileage", null); setMileageMin(""); setMileageMax(""); },
        }]
      : []),
    ...(radiusKm > 0 && radiusUsable
      ? [{
          label: `Within ${radiusKm} km of ${selectedLocations[0]}`,
          clear: () => setParam("radius", null),
        }]
      : []),
    ...(financing    ? [{ label: "Finance available", clear: () => setParam("financing",    null) }] : []),
    ...(hirePurchase ? [{ label: "Hire purchase",     clear: () => setParam("hire_purchase", null) }] : []),
    ...(get("verified")           === "1" ? [{ label: "Verified dealer",       clear: () => setParam("verified",           null) }] : []),
    ...(get("trust_inspection")   === "1" ? [{ label: "Independent inspection", clear: () => setParam("trust_inspection",   null) }] : []),
    ...(get("trust_service")      === "1" ? [{ label: "Service history",        clear: () => setParam("trust_service",      null) }] : []),
    ...(get("trust_ownership")    === "1" ? [{ label: "Ownership verified",     clear: () => setParam("trust_ownership",    null) }] : []),
    ...(get("trust_vin")          === "1" ? [{ label: "VIN verified",           clear: () => setParam("trust_vin",          null) }] : []),
    ...(get("trust_mileage")      === "1" ? [{ label: "Mileage verified",       clear: () => setParam("trust_mileage",      null) }] : []),
    ...(get("trust_logbook")      === "1" ? [{ label: "Logbook verified",       clear: () => setParam("trust_logbook",      null) }] : []),
    ...(accidentFreeOnly                  ? [{ label: "Accident-free only",     clear: () => setParam("accident_history",   null) }] : []),
    ...(searchMake ? [{ label: `Make: ${searchMake}`, clear: () => setParam("smake", null) }] : []),
    ...(get("smodel") ? [{ label: `Model: ${get("smodel")}`, clear: () => setParam("smodel", null) }] : []),
  ];

  function saveSearch() {
    const key = "agnora_saved_searches";
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      const url = window.location.search;
      if (!saved.includes(url)) {
        localStorage.setItem(key, JSON.stringify([...saved, url].slice(-10)));
      }
    } catch { /* ignore */ }
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  }

  const renderSidebar = () => (
    <>
      <FilterSection title="Search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input value={localQ} onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Make, model, keyword…" aria-label="Search cars"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
        </div>
      </FilterSection>

      <FilterSection title="Price range (KSh)">
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="Min" value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)} aria-label="Minimum price"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
          <span className="text-muted text-xs shrink-0">–</span>
          <input type="number" placeholder="Max" value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)} aria-label="Maximum price"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: "Under 1M",  min: "",        max: "1000000" },
            { label: "1–3M",      min: "1000000", max: "3000000" },
            { label: "3–5M",      min: "3000000", max: "5000000" },
            { label: "Over 5M",   min: "5000000", max: "" },
          ].map(({ label, min, max }) => (
            <button key={label} type="button"
              onClick={() => {
                setPriceMin(min); setPriceMax(max);
                const next = new URLSearchParams(params.toString());
                if (min) next.set("min_price", min); else next.delete("min_price");
                if (max) next.set("max_price", max); else next.delete("max_price");
                next.delete("page");
                router.push(`?${next}`, { scroll: false });
              }}
              className={cn(
                "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                (get("min_price") === min && get("max_price") === max)
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:border-accent/50",
              )}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={applyPriceRange}
          className="mt-2 w-full h-8 rounded-xl bg-surface-2 border border-border text-xs font-medium hover:bg-surface transition-colors">
          Apply price range
        </button>
      </FilterSection>

      <FilterSection title="Condition">
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map(({ value, label }) => {
            const count = value === "all" ? data.total : countFor(data.facets.conditions, value);
            return (
              <button key={value} type="button"
                onClick={() => setParam("condition", value === "all" ? null : value)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                  (value === "all" && !condition) || condition === value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:border-accent/50",
                )}>
                {label}{count > 0 && value !== "all" && <span className="ml-1 text-muted">({count})</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FacetCheckboxList
        title="Make"
        items={MAKES}
        facets={data.facets.makes}
        isSelected={(m) => isInSelected(selectedMakes, m)}
        onToggle={(m) => toggleMulti("make", slugify(m))}
        scroll
      />

      <FacetCheckboxList
        title="Body type"
        items={BODY_TYPES}
        facets={data.facets.bodyTypes}
        isSelected={(b) => isInSelected(selectedBodies, b)}
        onToggle={(b) => toggleMulti("body", b)}
        capitalize
      />

      <FacetCheckboxList
        title="Fuel type"
        items={FUELS}
        facets={data.facets.fuels}
        isSelected={(f) => isInSelected(selectedFuels, f)}
        onToggle={(f) => toggleMulti("fuel", f)}
        capitalize
      />

      <FilterSection title="Transmission">
        <div className="flex gap-1.5">
          {["auto", "manual"].map((t) => {
            const count = countFor(data.facets.transmissions, t);
            return (
              <button key={t} type="button"
                onClick={() => setParam("transmission", transmission === t ? null : t)}
                className={cn(
                  "flex-1 h-7 rounded-full border px-3 text-xs font-medium capitalize transition-all",
                  transmission === t ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/50",
                )}>
                {t}{count > 0 && <span className="ml-1 text-muted">({count})</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FacetCheckboxList
        title="Location"
        items={LOCATIONS}
        facets={data.facets.locations}
        isSelected={(l) => isInSelected(selectedLocations, l)}
        onToggle={(l) => toggleMulti("location", l)}
      />

      {/* PR4: Year range */}
      <FilterSection title="Year">
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="From" value={yearMin}
            onChange={(e) => setYearMin(e.target.value)} aria-label="Earliest year"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
          <span className="text-muted text-xs shrink-0">–</span>
          <input type="number" placeholder="To" value={yearMax}
            onChange={(e) => setYearMax(e.target.value)} aria-label="Latest year"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
        </div>
        <button type="button" onClick={applyYearRange}
          className="mt-2 w-full h-8 rounded-xl bg-surface-2 border border-border text-xs font-medium hover:bg-surface transition-colors">
          Apply year range
        </button>
      </FilterSection>

      {/* Tier 1: Mileage range — endpoint already accepts min_mileage / max_mileage */}
      <FilterSection title="Mileage (km)">
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="Min" value={mileageMin} min="0"
            onChange={(e) => setMileageMin(e.target.value)} aria-label="Minimum mileage in km"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
          <span className="text-muted text-xs shrink-0">–</span>
          <input type="number" placeholder="Max" value={mileageMax} min="0"
            onChange={(e) => setMileageMax(e.target.value)} aria-label="Maximum mileage in km"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: "Under 50k",  min: "",       max: "50000"  },
            { label: "50–100k",    min: "50000",  max: "100000" },
            { label: "100–150k",   min: "100000", max: "150000" },
            { label: "Over 150k",  min: "150000", max: ""       },
          ].map(({ label, min, max }) => (
            <button key={label} type="button"
              onClick={() => {
                setMileageMin(min); setMileageMax(max);
                const next = new URLSearchParams(params.toString());
                if (min) next.set("min_mileage", min); else next.delete("min_mileage");
                if (max) next.set("max_mileage", max); else next.delete("max_mileage");
                next.delete("page");
                router.push(`?${next}`, { scroll: false });
              }}
              className={cn(
                "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                (get("min_mileage") === min && get("max_mileage") === max)
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:border-accent/50",
              )}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={applyMileageRange}
          className="mt-2 w-full h-8 rounded-xl bg-surface-2 border border-border text-xs font-medium hover:bg-surface transition-colors">
          Apply mileage range
        </button>
      </FilterSection>

      {/* ──────────────────────────────────────────────────────────────────
          Advanced Filters — Tier 2. Collapsed by default; auto-opens when
          any of these filters is already active so URLs / shared links
          can't hide their state from the user.
      ────────────────────────────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen ? "true" : "false"}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface-2 text-xs font-semibold uppercase tracking-widest text-muted hover:text-foreground hover:border-accent/50 transition-colors"
        >
          <span>Advanced filters</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
        </button>
      </div>

      {advancedOpen && <>
      {/* PR5: Radius — enabled only with exactly one location selected */}
      <FilterSection title="Radius">
        {!radiusUsable && (
          <p className="text-[11px] text-muted mb-2 leading-snug">
            Pick exactly one location above to filter by distance.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map(({ km, label }) => {
            const active = km === radiusKm || (km === 0 && !radiusKm);
            return (
              <button
                key={km}
                type="button"
                disabled={!radiusUsable}
                onClick={() => setParam("radius", km === 0 ? null : String(km))}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:border-accent/50",
                  !radiusUsable && "opacity-40 cursor-not-allowed",
                )}>
                {label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* PR4: Drivetrain pills */}
      <FilterSection title="Drivetrain">
        <div className="flex flex-wrap gap-1.5">
          {DRIVETRAINS.map(({ value, label }) => {
            const count    = countFor(data.facets.drivetrains, value);
            const selected = isInSelected(selectedDrives, value);
            return (
              <button key={value} type="button"
                onClick={() => toggleMulti("drivetrain", value)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                  selected ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/50",
                )}>
                {label}{count > 0 && <span className="ml-1 text-muted">({count})</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* PR4: Exterior color */}
      <FacetCheckboxList
        title="Exterior color"
        items={EXTERIOR_COLORS}
        facets={data.facets.exteriorColors}
        isSelected={(c) => isInSelected(selectedColors, c)}
        onToggle={(c) => toggleMulti("ext_color", c)}
      />

      {/* PR4: Seller type */}
      <FilterSection title="Seller type">
        <div className="flex flex-wrap gap-1.5">
          {SELLER_TYPES.map(({ value, label }) => {
            const count    = countFor(data.facets.sellerTypes, value);
            const selected = isInSelected(selectedSellers, value);
            return (
              <button key={value} type="button"
                onClick={() => toggleMulti("seller_type", value)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                  selected ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/50",
                )}>
                {label}{count > 0 && <span className="ml-1 text-muted">({count})</span>}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* PR6: Trust & verification */}
      <FilterSection title="Trust & verification">
        <p className="text-[11px] text-muted mb-2 leading-snug">
          Filter for listings that meet Agnora's verification criteria.
        </p>
        <TrustCheckbox
          label="Verified dealer"
          active={get("verified") === "1"}
          onToggle={() => setParam("verified", get("verified") === "1" ? null : "1")}
        />
        <TrustCheckbox
          label="Independent inspection"
          active={get("trust_inspection") === "1"}
          onToggle={() => setParam("trust_inspection", get("trust_inspection") === "1" ? null : "1")}
        />
        <TrustCheckbox
          label="Service history"
          active={get("trust_service") === "1"}
          onToggle={() => setParam("trust_service", get("trust_service") === "1" ? null : "1")}
        />
        <TrustCheckbox
          label="Ownership verified"
          active={get("trust_ownership") === "1"}
          onToggle={() => setParam("trust_ownership", get("trust_ownership") === "1" ? null : "1")}
        />
        <TrustCheckbox
          label="VIN verified"
          active={get("trust_vin") === "1"}
          onToggle={() => setParam("trust_vin", get("trust_vin") === "1" ? null : "1")}
        />
        <TrustCheckbox
          label="Mileage verified"
          active={get("trust_mileage") === "1"}
          onToggle={() => setParam("trust_mileage", get("trust_mileage") === "1" ? null : "1")}
          subLabel="Odometer cross-checked"
        />
        <TrustCheckbox
          label="Logbook verified"
          active={get("trust_logbook") === "1"}
          onToggle={() => setParam("trust_logbook", get("trust_logbook") === "1" ? null : "1")}
          subLabel="Original logbook sighted"
        />
        <TrustCheckbox
          label="Accident-free only"
          active={getAll("accident_history").includes("none")}
          onToggle={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("accident_history");
            // Toggle: only "none" means accident-free filter on.
            if (!getAll("accident_history").includes("none")) {
              next.append("accident_history", "none");
            }
            next.delete("page");
            router.push(`?${next}`, { scroll: false });
          }}
          subLabel="Dealer declared no accidents"
        />
      </FilterSection>

      <FilterSection title="Finance options">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={financing}
            onChange={() => setParam("financing", financing ? null : "1")}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer" />
          <span className="text-sm group-hover:text-foreground transition-colors flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-accent" /> Finance available
          </span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group mt-1.5">
          <input type="checkbox" checked={hirePurchase}
            onChange={() => setParam("hire_purchase", hirePurchase ? null : "1")}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer" />
          <span className="text-sm group-hover:text-foreground transition-colors">Hire purchase</span>
        </label>
      </FilterSection>
      </>}

      {activeFilters.length > 0 && (
        <button type="button" onClick={clearAll}
          className="w-full h-9 rounded-full border border-border text-xs font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors">
          Clear all filters
        </button>
      )}
    </>
  );

  const cars       = data.cars;
  const totalPages = data.totalPages;
  const total      = data.total;
  const totalAcrossAll = initial.total;

  return (
    <div className="container max-w-container">
      {/* Sticky mobile search bar — opens full-screen autocomplete overlay on tap */}
      <div className="lg:hidden sticky top-16 z-30 -mx-5 px-5 py-3 bg-background/95 backdrop-blur-md border-b border-border">
        <MobileSearchTrigger
          value={localQ}
          onChange={setLocalQ}
          activeFiltersCount={activeFilters.length}
          onOpenFilters={() => setSidebarOpen(true)}
        />
      </div>

      <div className="py-6 lg:py-12">
        {/* Desktop advanced search bar */}
        <div className="hidden lg:block mb-8 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-44">
              <select value={searchMake} onChange={(e) => setParam("smake", e.target.value || null)}
                aria-label="Select make"
                className="w-full h-11 appearance-none rounded-xl border border-border bg-surface-2 pl-4 pr-8 text-sm outline-none focus:border-accent cursor-pointer">
                <option value="">All makes</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            </div>

            <input value={localModel} onChange={(e) => setLocalModel(e.target.value)}
              placeholder="Model (e.g. Harrier, CX-5…)" aria-label="Model"
              className="sm:w-44 h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted" />

            <div className="flex-1">
              <SearchAutocomplete
                value={localQ}
                onChange={setLocalQ}
                placeholder="Search by keyword, year, trim, dealer name…"
                source="cars-listing-desktop"
                inputClassName="h-11 rounded-xl"
              />
            </div>

            <div className="relative sm:w-44">
              <select value={condition} onChange={(e) => setParam("condition", e.target.value || null)}
                aria-label="Condition"
                className="w-full h-11 appearance-none rounded-xl border border-border bg-surface-2 pl-4 pr-8 text-sm outline-none focus:border-accent cursor-pointer">
                {CONDITIONS.map(({ value, label }) => (
                  <option key={value} value={value === "all" ? "" : value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium">Cars for sale</h1>
            <p className="text-sm text-muted mt-1 flex items-center gap-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden /> : null}
              {total.toLocaleString()} {total === 1 ? "car" : "cars"} found
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setShowWishlist((v) => !v)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                showWishlist ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
              )}>
              <Heart className={cn("h-4 w-4", showWishlist && "fill-accent")} />
              Saved{wishlistIds.size > 0 && ` (${wishlistIds.size})`}
            </button>
            <button type="button" onClick={saveSearch}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors">
              {saveToast ? <CheckIcon className="h-4 w-4 text-green-500" /> : <BookmarkPlus className="h-4 w-4" />}
              {saveToast ? "Saved!" : "Save search"}
            </button>
            <button type="button" onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Wishlist panel */}
        {showWishlist && (
          <div className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-accent fill-accent" /> Saved cars
              </p>
              <button type="button" aria-label="Close saved cars" onClick={() => setShowWishlist(false)}
                className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {wishlistCars.length === 0 ? (
              <p className="text-sm text-muted">No saved cars yet. Tap the heart on a car to save it.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {wishlistCars.map((car) => (<CarCard key={car.id} car={car} />))}
              </div>
            )}
          </div>
        )}

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeFilters.map(({ label, clear }) => (
              <button key={label} type="button" onClick={clear}
                className="flex items-center gap-1.5 h-7 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium hover:border-accent/50 hover:bg-accent-soft transition-all">
                {label} <X className="h-3 w-3" />
              </button>
            ))}
            <button type="button" onClick={clearAll}
              className="h-7 rounded-full px-3 text-xs text-muted hover:text-foreground transition-colors">
              Clear all
            </button>
          </div>
        )}

        <div className="flex gap-6">
          <aside className="hidden lg:block w-60 shrink-0 space-y-5">
            {renderSidebar()}
          </aside>

          <div className="flex-1 min-w-0">
            {/* Sort */}
            <div className="flex items-center justify-end mb-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted hidden sm:block">Sort:</span>
                <div className="relative">
                  <select value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort by"
                    className="h-9 appearance-none rounded-xl border border-border bg-surface-2 pl-3 pr-8 text-sm outline-none focus:border-accent cursor-pointer">
                    {SORT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {loading && cars.length === 0 ? (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : totalAcrossAll === 0 ? (
              <div className="flex flex-col items-center py-24 text-center">
                <div className="mb-6 h-24 w-24 rounded-full bg-surface-2 flex items-center justify-center">
                  <svg className="h-12 w-12 text-muted/40" aria-hidden fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17H5a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-3m-6 0h6m-3 0v0" />
                  </svg>
                </div>
                <h2 className="font-display text-2xl font-medium mb-2">No cars listed yet</h2>
                <p className="text-muted mb-6 max-w-sm">Be the first. No account required — list your car in under four minutes and reach buyers across Kenya.</p>
                <a href="/sell/new"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity">
                  List your car <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            ) : cars.length === 0 ? (
              <EmptyFiltered
                onClearAll={clearAll}
                broadenSuggestions={activeFilters.slice(0, 3)}
              />
            ) : (
              <>
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {cars.map((car, i) => (
                    <div key={car.id} className={cn("animate-fade-up", STAGGER[i] ?? "")}>
                      <CarCard car={car} priority={i < 3} />
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button type="button" disabled={page <= 1}
                      onClick={() => setParam("page", String(page - 1))}
                      className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-40">
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button key={p} type="button"
                          onClick={() => setParam("page", String(p))}
                          className={cn(
                            "h-9 w-9 rounded-full text-sm font-medium transition-all",
                            p === page ? "bg-accent text-white" : "border border-border hover:bg-surface-2",
                          )}>{p}</button>
                      );
                    })}
                    <button type="button" disabled={page >= totalPages}
                      onClick={() => setParam("page", String(page + 1))}
                      className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-40">
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {recentlyViewed.length > 0 && (
              <div className="mt-14">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="h-4 w-4 text-muted" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recently viewed</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recentlyViewed.slice(0, 3).map((car) => (<CarCard key={car.id} car={car} />))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background border-t border-border">
            <div className="sticky top-0 flex items-center justify-between bg-background px-5 py-4 border-b border-border z-10">
              <p className="font-semibold">Filters</p>
              <button type="button" aria-label="Close filters" onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {renderSidebar()}
              <button type="button" onClick={() => setSidebarOpen(false)}
                className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold">
                Show {total} results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  );
}

function TrustCheckbox({
  label, active, onToggle, subLabel,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  subLabel?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group mt-1.5 first:mt-0">
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer shrink-0"
      />
      <span className="flex-1">
        <span className="block text-sm group-hover:text-foreground transition-colors">{label}</span>
        {subLabel && <span className="block text-[10px] text-muted leading-tight">{subLabel}</span>}
      </span>
    </label>
  );
}

function FacetCheckboxList({
  title, items, facets, isSelected, onToggle, capitalize, scroll,
}: {
  title: string;
  items: string[];
  facets: FacetBucket[] | undefined;
  isSelected: (v: string) => boolean;
  onToggle: (v: string) => void;
  capitalize?: boolean;
  scroll?: boolean;
}) {
  return (
    <FilterSection title={title}>
      <div className={cn("space-y-1.5", scroll && "max-h-48 overflow-y-auto")}>
        {items.map((value) => {
          const count   = countFor(facets, value);
          const checked = isSelected(value);
          const dim     = count === 0 && !checked;
          return (
            <label key={value} className={cn("flex items-center gap-2.5 cursor-pointer group", dim && "opacity-50")}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(value)}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <span className={cn(
                "flex-1 text-sm group-hover:text-foreground transition-colors",
                capitalize && "capitalize",
              )}>{value}</span>
              {count > 0 && (
                <span className="text-[11px] text-muted tabular-nums">{count}</span>
              )}
            </label>
          );
        })}
      </div>
    </FilterSection>
  );
}

function EmptyFiltered({
  onClearAll, broadenSuggestions,
}: {
  onClearAll: () => void;
  broadenSuggestions: { label: string; clear: () => void }[];
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <svg className="mb-5 h-20 w-20 text-muted/20" viewBox="0 0 96 96" fill="none" aria-hidden>
        <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="4" />
        <path d="M60 60 L80 80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 40h16M40 32v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h2 className="font-display text-xl font-medium mb-2">No exact matches found</h2>
      <p className="text-sm text-muted mb-5 max-w-sm">
        Try removing a filter to broaden your search, or clear everything and start over.
      </p>
      {broadenSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="text-xs text-muted">Try removing:</span>
          {broadenSuggestions.map(({ label, clear }) => (
            <button key={label} type="button" onClick={clear}
              className="inline-flex items-center gap-1.5 h-7 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium hover:border-accent/50 hover:bg-accent-soft transition-all">
              {label} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onClearAll}
        className="h-10 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors">
        Clear all filters
      </button>
    </div>
  );
}

export function CarsListing({ initial }: Props) {
  return (
    <Suspense fallback={
      <div className="container max-w-container py-12">
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <CarsListingInner initial={initial} />
    </Suspense>
  );
}
