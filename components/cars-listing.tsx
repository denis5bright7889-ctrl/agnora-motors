"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CarCard } from "@/components/car-card";
import { SkeletonCard } from "@/components/skeleton-card";
import {
  SlidersHorizontal, X, ChevronDown, Search, BookmarkPlus,
  CheckIcon, Heart, Clock, ChevronRight, Banknote,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useWishlist } from "@/lib/store";
import { getRecentlyViewedIds } from "@/lib/store";
import type { Car } from "@/types";

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
const SORT_OPTIONS = [
  { value: "newest",     label: "Newest first" },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "mileage_asc",label: "Lowest mileage" },
  { value: "year_desc",  label: "Newest year" },
];
const PAGE_SIZE = 12;

const STAGGER = [
  "",
  "[animation-delay:40ms]",
  "[animation-delay:80ms]",
  "[animation-delay:120ms]",
  "[animation-delay:160ms]",
  "[animation-delay:200ms]",
  "[animation-delay:240ms]",
  "[animation-delay:280ms]",
  "[animation-delay:320ms]",
  "[animation-delay:360ms]",
  "[animation-delay:400ms]",
  "[animation-delay:440ms]",
];

interface Props { allCars: Car[] }

function useRecentlyViewed(allCars: Car[]) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { setIds(getRecentlyViewedIds()); }, []);
  return ids
    .map((id) => allCars.find((c) => c.id === id))
    .filter(Boolean) as Car[];
}

function CarsListingInner({ allCars }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [localQ, setLocalQ] = useState(() => params.get("q") ?? "");
  const [localModel, setLocalModel] = useState(() => params.get("smodel") ?? "");

  // Global wishlist context (replaces local hook)
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  const recentlyViewed = useRecentlyViewed(allCars);

  function get(key: string) { return params.get(key) ?? ""; }
  function getAll(key: string) { return params.getAll(key); }

  const condition        = get("condition");
  const selectedMakes    = getAll("make");
  const selectedBodies   = getAll("body");
  const selectedFuels    = getAll("fuel");
  const selectedLocations = getAll("location");
  const transmission     = get("transmission");
  const minPrice  = get("min_price") ? Number(get("min_price")) : 0;
  const maxPrice  = get("max_price") ? Number(get("max_price")) : 0;
  const sort  = get("sort") || "newest";
  const page  = Number(get("page") || "1");
  const q     = get("q").toLowerCase();
  const searchMake  = get("smake");
  const searchModel = get("smodel").toLowerCase();
  const financing   = get("financing") === "1";
  const hirePurchase = get("hire_purchase") === "1";

  useEffect(() => { setLocalQ(get("q")); },     // eslint-disable-next-line react-hooks/exhaustive-deps
    [get("q")]);
  useEffect(() => { setLocalModel(get("smodel")); }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [get("smodel")]);

  useEffect(() => {
    if (get("min_price")) setPriceMin(get("min_price"));
    if (get("max_price")) setPriceMax(get("max_price"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (localQ) next.set("q", localQ); else next.delete("q");
      next.delete("page");
      router.push(`?${next}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (localModel) next.set("smodel", localModel); else next.delete("smodel");
      next.delete("page");
      router.push(`?${next}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localModel]);

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
    if (existing.includes(value)) {
      existing.filter((v) => v !== value).forEach((v) => next.append(key, v));
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

  function clearAll() {
    setLocalQ("");
    setLocalModel("");
    router.push("/cars", { scroll: false });
  }

  const filtered = useMemo(() => {
    let result = [...allCars];
    const combinedQ = [q, searchModel].filter(Boolean).join(" ");
    if (combinedQ) {
      result = result.filter((c) =>
        `${c.year} ${c.make} ${c.model} ${c.trim ?? ""}`.toLowerCase().includes(combinedQ)
      );
    }
    if (searchMake) result = result.filter((c) => c.make === searchMake);
    if (condition && condition !== "all") result = result.filter((c) => c.condition === condition);
    if (selectedMakes.length) result = result.filter((c) => selectedMakes.includes(c.make));
    if (selectedBodies.length) result = result.filter((c) => selectedBodies.includes(c.bodyType));
    if (selectedFuels.length) result = result.filter((c) => selectedFuels.includes(c.fuel));
    if (selectedLocations.length) result = result.filter((c) => selectedLocations.includes(c.location));
    if (transmission) result = result.filter((c) => c.transmission === transmission);
    if (minPrice > 0) result = result.filter((c) => c.price >= minPrice);
    if (maxPrice > 0) result = result.filter((c) => c.price <= maxPrice);
    if (financing) result = result.filter((c) => c.financingAvailable);
    if (hirePurchase) result = result.filter((c) => c.hirePurchaseAvailable);

    if (sort === "price_asc")   result.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc")  result.sort((a, b) => b.price - a.price);
    else if (sort === "mileage_asc") result.sort((a, b) => a.mileage - b.mileage);
    else if (sort === "year_desc")   result.sort((a, b) => b.year - a.year);
    else result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [allCars, q, searchModel, searchMake, condition, selectedMakes, selectedBodies,
      selectedFuels, selectedLocations, transmission, minPrice, maxPrice,
      financing, hirePurchase, sort]);

  const wishlistCars = useMemo(
    () => allCars.filter((c) => wishlistIds.has(c.id)),
    [allCars, wishlistIds],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters: { label: string; clear: () => void }[] = [
    ...(condition && condition !== "all"
      ? [{ label: `${CONDITIONS.find((c) => c.value === condition)?.label ?? condition}`, clear: () => setParam("condition", null) }]
      : []),
    ...selectedMakes.map((m) => ({ label: m, clear: () => toggleMulti("make", m) })),
    ...selectedBodies.map((b) => ({ label: b, clear: () => toggleMulti("body", b) })),
    ...selectedFuels.map((f) => ({ label: f, clear: () => toggleMulti("fuel", f) })),
    ...selectedLocations.map((l) => ({ label: l, clear: () => toggleMulti("location", l) })),
    ...(transmission ? [{ label: `${transmission === "auto" ? "Automatic" : "Manual"}`, clear: () => setParam("transmission", null) }] : []),
    ...(get("min_price") || get("max_price")
      ? [{ label: `KSh ${get("min_price") ? formatPrice(Number(get("min_price"))) : "0"} – ${get("max_price") ? formatPrice(Number(get("max_price"))) : "any"}`, clear: () => { setParam("min_price", null); setParam("max_price", null); setPriceMin(""); setPriceMax(""); } }]
      : []),
    ...(financing ? [{ label: "Finance available", clear: () => setParam("financing", null) }] : []),
    ...(hirePurchase ? [{ label: "Hire purchase", clear: () => setParam("hire_purchase", null) }] : []),
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
          <input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Make, model, keyword…"
            aria-label="Search cars"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
      </FilterSection>

      <FilterSection title="Price range (KSh)">
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            aria-label="Minimum price"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
          <span className="text-muted text-xs shrink-0">–</span>
          <input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            aria-label="Maximum price"
            className="w-full h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: "Under 1M",  min: "",        max: "1000000" },
            { label: "1–3M",      min: "1000000", max: "3000000" },
            { label: "3–5M",      min: "3000000", max: "5000000" },
            { label: "Over 5M",   min: "5000000", max: "" },
          ].map(({ label, min, max }) => (
            <button
              key={label}
              type="button"
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
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={applyPriceRange}
          className="mt-2 w-full h-8 rounded-xl bg-surface-2 border border-border text-xs font-medium hover:bg-surface transition-colors"
        >
          Apply price range
        </button>
      </FilterSection>

      <FilterSection title="Condition">
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam("condition", value === "all" ? null : value)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                (value === "all" && !condition) || condition === value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border hover:border-accent/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Make">
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {MAKES.map((m) => (
            <label key={m} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedMakes.includes(m)}
                onChange={() => toggleMulti("make", m)}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <span className="text-sm group-hover:text-foreground transition-colors">{m}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Body type">
        <div className="space-y-1.5">
          {BODY_TYPES.map((b) => (
            <label key={b} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedBodies.includes(b)}
                onChange={() => toggleMulti("body", b)}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <span className="text-sm capitalize group-hover:text-foreground transition-colors">{b}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Fuel type">
        <div className="space-y-1.5">
          {FUELS.map((f) => (
            <label key={f} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedFuels.includes(f)}
                onChange={() => toggleMulti("fuel", f)}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <span className="text-sm capitalize group-hover:text-foreground transition-colors">{f}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Transmission">
        <div className="flex gap-1.5">
          {["auto", "manual"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setParam("transmission", transmission === t ? null : t)}
              className={cn(
                "flex-1 h-7 rounded-full border px-3 text-xs font-medium capitalize transition-all",
                transmission === t ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/50",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Location">
        <div className="space-y-1.5">
          {LOCATIONS.map((l) => (
            <label key={l} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedLocations.includes(l)}
                onChange={() => toggleMulti("location", l)}
                className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <span className="text-sm group-hover:text-foreground transition-colors">{l}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Finance options">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={financing}
            onChange={() => setParam("financing", financing ? null : "1")}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
          />
          <span className="text-sm group-hover:text-foreground transition-colors flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-accent" /> Finance available
          </span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group mt-1.5">
          <input
            type="checkbox"
            checked={hirePurchase}
            onChange={() => setParam("hire_purchase", hirePurchase ? null : "1")}
            className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
          />
          <span className="text-sm group-hover:text-foreground transition-colors">Hire purchase</span>
        </label>
      </FilterSection>

      {activeFilters.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="w-full h-9 rounded-full border border-border text-xs font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <div className="container max-w-container">
      {/* ── Sticky mobile search bar ─────────────────────────────
          Sits just below the top navbar (top-16 = 4rem = 64px).
          Full-width bleed achieved with -mx-5 px-5 on mobile. ── */}
      <div className="lg:hidden sticky top-16 z-30 -mx-5 px-5 py-3 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder="Search make, model…"
              aria-label="Search cars"
              className="w-full h-11 rounded-full border border-border bg-surface-2 pl-10 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
            />
            {localQ && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setLocalQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open filters"
            className={cn(
              "flex shrink-0 items-center gap-1.5 h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              activeFilters.length > 0
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface-2",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters.length > 0 ? activeFilters.length : ""}
          </button>
        </div>
      </div>

      <div className="py-6 lg:py-12">
        {/* ── Desktop full advanced search bar ── */}
        <div className="hidden lg:block mb-8 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-44">
              <select
                value={searchMake}
                onChange={(e) => setParam("smake", e.target.value || null)}
                aria-label="Select make"
                className="w-full h-11 appearance-none rounded-xl border border-border bg-surface-2 pl-4 pr-8 text-sm outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All makes</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            </div>

            <input
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              placeholder="Model (e.g. Harrier, CX-5…)"
              aria-label="Model"
              className="sm:w-44 h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted"
            />

            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                placeholder="Search by keyword, year, trim…"
                aria-label="Free text search"
                className="w-full h-11 rounded-xl border border-border bg-surface-2 pl-10 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
              />
            </div>

            <div className="relative sm:w-44">
              <select
                value={condition}
                onChange={(e) => setParam("condition", e.target.value || null)}
                aria-label="Condition"
                className="w-full h-11 appearance-none rounded-xl border border-border bg-surface-2 pl-4 pr-8 text-sm outline-none focus:border-accent cursor-pointer"
              >
                {CONDITIONS.map(({ value, label }) => (
                  <option key={value} value={value === "all" ? "" : value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium">Cars for sale</h1>
            <p className="text-sm text-muted mt-1">
              {filtered.length.toLocaleString()} {filtered.length === 1 ? "car" : "cars"} found
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowWishlist((v) => !v)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                showWishlist ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
              )}
            >
              <Heart className={cn("h-4 w-4", showWishlist && "fill-accent")} />
              Saved{wishlistIds.size > 0 && ` (${wishlistIds.size})`}
            </button>
            <button
              type="button"
              onClick={saveSearch}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              {saveToast ? <CheckIcon className="h-4 w-4 text-green-500" /> : <BookmarkPlus className="h-4 w-4" />}
              {saveToast ? "Saved!" : "Save search"}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
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

        {/* ── Wishlist panel ── */}
        {showWishlist && (
          <div className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-accent fill-accent" /> Saved cars
              </p>
              <button type="button" aria-label="Close saved cars" onClick={() => setShowWishlist(false)} className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {wishlistCars.length === 0 ? (
              <p className="text-sm text-muted">No saved cars yet. Tap the heart on a car to save it.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {wishlistCars.map((car) => (
                  <CarCard key={car.id} car={car} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Active filter pills ── */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeFilters.map(({ label, clear }) => (
              <button
                key={label}
                type="button"
                onClick={clear}
                className="flex items-center gap-1.5 h-7 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium hover:border-accent/50 hover:bg-accent-soft transition-all"
              >
                {label} <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="h-7 rounded-full px-3 text-xs text-muted hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex gap-6">
          {/* ── Sidebar filters (desktop) ── */}
          <aside className="hidden lg:block w-60 shrink-0 space-y-5">
            {renderSidebar()}
          </aside>

          {/* ── Main grid ── */}
          <div className="flex-1 min-w-0">
            {/* Sort */}
            <div className="flex items-center justify-end mb-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted hidden sm:block">Sort:</span>
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setParam("sort", e.target.value)}
                    aria-label="Sort by"
                    className="h-9 appearance-none rounded-xl border border-border bg-surface-2 pl-3 pr-8 text-sm outline-none focus:border-accent cursor-pointer"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {allCars.length === 0 ? (
              <div className="flex flex-col items-center py-24 text-center">
                <div className="mb-6 h-24 w-24 rounded-full bg-surface-2 flex items-center justify-center">
                  <svg className="h-12 w-12 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17H5a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-3m-6 0h6m-3 0v0" />
                  </svg>
                </div>
                <h2 className="font-display text-2xl font-medium mb-2">No cars available yet</h2>
                <p className="text-muted mb-6 max-w-sm">Be the first to list. No account needed — upload your car and reach thousands of buyers across Kenya.</p>
                <a
                  href="/sell/new"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  List your first car <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <svg className="mb-5 h-20 w-20 text-muted/20" viewBox="0 0 96 96" fill="none" aria-hidden>
                  <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="4" />
                  <path d="M60 60 L80 80" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  <path d="M32 40h16M40 32v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <h2 className="font-display text-xl font-medium mb-2">No cars match your filters</h2>
                <p className="text-sm text-muted mb-6">Try adjusting or clearing your filters</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-10 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                {/* 1 column on mobile, 2 on sm, 3 on lg */}
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {paginated.map((car, i) => (
                    <div
                      key={car.id}
                      className={cn("animate-fade-up", STAGGER[i] ?? "")}
                    >
                      <CarCard car={car} priority={i < 3} />
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setParam("page", String(page - 1))}
                      className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setParam("page", String(p))}
                          className={cn(
                            "h-9 w-9 rounded-full text-sm font-medium transition-all",
                            p === page ? "bg-accent text-white" : "border border-border hover:bg-surface-2",
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setParam("page", String(page + 1))}
                      className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-40"
                    >
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
                  {recentlyViewed.slice(0, 3).map((car) => (
                    <CarCard key={car.id} car={car} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter bottom sheet ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background border-t border-border">
            <div className="sticky top-0 flex items-center justify-between bg-background px-5 py-4 border-b border-border z-10">
              <p className="font-semibold">Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {renderSidebar()}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold"
              >
                Show {filtered.length} results
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

export function CarsListing({ allCars }: Props) {
  return (
    <Suspense fallback={
      <div className="container max-w-container py-12">
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <CarsListingInner allCars={allCars} />
    </Suspense>
  );
}
