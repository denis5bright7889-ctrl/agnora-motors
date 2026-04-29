"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { brands } from "@/data/content";
import type { Car } from "@/types";

const PRICE_BANDS = [
  { label: "Any price", min: "", max: "" },
  { label: "Under KSh 1M", min: "", max: "1000000" },
  { label: "KSh 1M – 2M", min: "1000000", max: "2000000" },
  { label: "KSh 2M – 4M", min: "2000000", max: "4000000" },
  { label: "KSh 4M – 7M", min: "4000000", max: "7000000" },
  { label: "Over KSh 7M", min: "7000000", max: "" },
];

export function HeroSearch() {
  const router = useRouter();
  const [condition, setCondition] = useState("all");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [priceIdx, setPriceIdx] = useState(0);
  const [cars, setCars] = useState<Car[]>([]);

  useEffect(() => {
    async function loadCars() {
      const response = await fetch("/api/cars", { cache: "no-store" });
      const payload = await response.json();
      setCars(Array.isArray(payload?.cars) ? payload.cars : []);
    }
    void loadCars();
  }, []);

  const models = useMemo(() => {
    if (!make) return [];
    return Array.from(new Set(cars.filter((c) => c.make === make).map((c) => c.model)));
  }, [make]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (condition !== "all") params.set("condition", condition);
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    const band = PRICE_BANDS[priceIdx];
    if (band.min) params.set("min_price", band.min);
    if (band.max) params.set("max_price", band.max);
    router.push(`/cars${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-border bg-surface p-2 shadow-xl shadow-black/5 dark:shadow-black/30"
    >
      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {[
          { v: "all", l: "All" },
          { v: "new", l: "New" },
          { v: "used", l: "Used" },
          { v: "certified", l: "Certified" },
        ].map((t) => {
          const active = condition === t.v;
          return active ? (
            <button
              key={t.v}
              type="button"
              onClick={() => setCondition(t.v)}
              className="flex-1 h-9 rounded-xl text-xs font-medium uppercase tracking-wide transition-all bg-surface text-foreground shadow-sm"
              aria-pressed="true"
            >
              {t.l}
            </button>
          ) : (
            <button
              key={t.v}
              type="button"
              onClick={() => setCondition(t.v)}
              className="flex-1 h-9 rounded-xl text-xs font-medium uppercase tracking-wide transition-all text-muted hover:text-foreground"
              aria-pressed="false"
            >
              {t.l}
            </button>
          );
        })}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2 p-2">
        <SelectField
          label="Make"
          value={make}
          onChange={(v) => { setMake(v); setModel(""); }}
          placeholder="Any make"
          options={brands.map((b) => ({ value: b.name, label: b.name }))}
        />
        <SelectField
          label="Model"
          value={model}
          onChange={setModel}
          placeholder={make ? "Any model" : "Pick a make first"}
          disabled={!make}
          options={models.map((m) => ({ value: m, label: m }))}
        />
        <SelectField
          label="Price"
          value={String(priceIdx)}
          onChange={(v) => setPriceIdx(Number(v))}
          options={PRICE_BANDS.map((b, i) => ({ value: String(i), label: b.label }))}
        />
        <SelectField
          label="Condition"
          value={condition}
          onChange={setCondition}
          options={[
            { value: "all", label: "All conditions" },
            { value: "new", label: "New" },
            { value: "used", label: "Used" },
            { value: "certified", label: "Certified" },
          ]}
        />
      </div>

      <button
        type="submit"
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        <Search className="h-4 w-4" />
        Search {cars.length} cars
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function SelectField({
  label, value, onChange, options, placeholder, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block rounded-xl border border-border bg-background p-3 cursor-pointer transition-colors hover:bg-surface-2 has-[:focus]:ring-2 has-[:focus]:ring-accent">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-0.5 w-full bg-transparent text-sm font-medium text-foreground outline-none disabled:opacity-50 cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
