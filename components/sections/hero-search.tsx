"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Loader2 } from "lucide-react";
import type { Make, Model } from "@/types";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { trackEvent } from "@/lib/analytics";

const PRICE_BANDS = [
  { label: "Any price",         min: "", max: "" },
  { label: "Under KSh 1M",      min: "", max: "1000000" },
  { label: "KSh 1M – 2M",       min: "1000000", max: "2000000" },
  { label: "KSh 2M – 4M",       min: "2000000", max: "4000000" },
  { label: "KSh 4M – 7M",       min: "4000000", max: "7000000" },
  { label: "Over KSh 7M",       min: "7000000", max: "" },
];

const LOCATIONS = ["All Kenya", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika"];

export function HeroSearch() {
  const router = useRouter();

  const [q,         setQ]         = useState("");
  const [condition, setCondition] = useState("all");
  const [makes,     setMakes]     = useState<Make[]>([]);
  const [models,    setModels]    = useState<Model[]>([]);
  const [makeSlug,  setMakeSlug]  = useState("");
  const [modelSlug, setModelSlug] = useState("");
  const [priceIdx,  setPriceIdx]  = useState(0);
  const [location,  setLocation]  = useState("All Kenya");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Load makes + total car count once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/makes")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setMakes(data.makes ?? []); })
      .catch(() => {});
    fetch("/api/cars/search?limit=1")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setTotalCount(data.total ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load models when make changes. Model resets whenever make changes.
  useEffect(() => {
    setModelSlug("");
    if (!makeSlug) { setModels([]); return; }
    let cancelled = false;
    setModelsLoading(true);
    fetch(`/api/makes/${makeSlug}/models`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setModels(data.models ?? []); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [makeSlug]);

  function buildSearchUrl(extraQ?: string): string {
    const params = new URLSearchParams();
    const finalQ = (extraQ ?? q).trim();
    if (finalQ)                   params.set("q",         finalQ);
    if (condition !== "all")      params.set("condition", condition);
    if (makeSlug)                 params.set("make",      makeSlug);
    if (modelSlug)                params.set("model",     modelSlug);
    if (location && location !== "All Kenya") params.set("location", location);
    const band = PRICE_BANDS[priceIdx];
    if (band.min) params.set("min_price", band.min);
    if (band.max) params.set("max_price", band.max);
    return `/cars${params.toString() ? `?${params}` : ""}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    trackEvent("search_submitted", { q, source: "hero" });
    router.push(buildSearchUrl());
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-border bg-surface p-2 shadow-xl shadow-black/5 dark:shadow-black/30"
    >
      {/* Universal search bar with autocomplete (PR3b) */}
      <div className="p-1.5 pb-2">
        <SearchAutocomplete
          value={q}
          onChange={setQ}
          onSubmit={(text) => router.push(buildSearchUrl(text))}
          placeholder="Search make, model, dealer or keyword"
          source="hero"
          inputClassName="h-12 bg-background"
        />
      </div>

      {/* Condition tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {[
          { v: "all",       l: "All" },
          { v: "new",       l: "New" },
          { v: "used",      l: "Used" },
          { v: "certified", l: "Certified" },
        ].map((t) => {
          const active = condition === t.v;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => setCondition(t.v)}
              aria-pressed={active ? "true" : "false"}
              className={
                active
                  ? "flex-1 h-9 rounded-xl text-xs font-medium uppercase tracking-wide bg-surface text-foreground shadow-sm transition-all"
                  : "flex-1 h-9 rounded-xl text-xs font-medium uppercase tracking-wide text-muted hover:text-foreground transition-all"
              }
            >
              {t.l}
            </button>
          );
        })}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-2 p-2">
        <SelectField
          label="Make"
          value={makeSlug}
          onChange={setMakeSlug}
          placeholder="Any make"
          options={makes.map((m) => ({ value: m.slug, label: m.name }))}
        />
        <SelectField
          label="Model"
          value={modelSlug}
          onChange={setModelSlug}
          placeholder={
            !makeSlug ? "Pick a make first" :
            modelsLoading ? "Loading…" :
            models.length === 0 ? "No models" :
            "Any model"
          }
          disabled={!makeSlug || modelsLoading || models.length === 0}
          loading={modelsLoading}
          options={models.map((m) => ({ value: m.slug, label: m.name }))}
        />
        <SelectField
          label="Price"
          value={String(priceIdx)}
          onChange={(v) => setPriceIdx(Number(v))}
          options={PRICE_BANDS.map((b, i) => ({ value: String(i), label: b.label }))}
        />
        <SelectField
          label="Location"
          value={location}
          onChange={setLocation}
          options={LOCATIONS.map((l) => ({ value: l, label: l }))}
        />
      </div>

      <button
        type="submit"
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        <Search className="h-4 w-4" />
        {totalCount === null ? "Search cars" : `Search ${totalCount.toLocaleString()} cars`}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function SelectField({
  label, value, onChange, options, placeholder, disabled, loading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <label
      className={
        "block rounded-xl border border-border p-3 transition-colors has-[:focus]:ring-2 has-[:focus]:ring-accent " +
        (disabled ? "bg-surface-2/50 cursor-not-allowed opacity-60" : "bg-background cursor-pointer hover:bg-surface-2")
      }
    >
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label}
          className="mt-0.5 w-full bg-transparent text-sm font-medium text-foreground outline-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {loading && (
          <Loader2 className="absolute right-0 top-1.5 h-3 w-3 animate-spin text-muted pointer-events-none" aria-hidden />
        )}
      </div>
    </label>
  );
}
