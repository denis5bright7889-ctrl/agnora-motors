"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { brands } from "@/data/content";
import { formatPrice } from "@/lib/utils";
import type { Car } from "@/types";

const schema = z.object({
  year: z.string().min(1, "Select a year"),
  make: z.string().min(1, "Select a make"),
  model: z.string().min(1, "Select a model"),
  mileage: z.string().min(1, "Enter mileage"),
  location: z.string().min(1, "Select location"),
});

type FormData = z.infer<typeof schema>;

const YEARS = Array.from({ length: 12 }, (_, i) => String(2025 - i));

export function ValuationForm() {
  const [result, setResult] = useState<{ low: number; high: number; make: string; model: string } | null>(null);
  const [selectedMake, setSelectedMake] = useState("");
  const [cars, setCars] = useState<Car[]>([]);
  const models = Array.from(new Set(cars.filter((c) => c.make === selectedMake).map((c) => c.model)));
  const locations = Array.from(new Set(cars.map((c) => c.location))).sort();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const make = watch("make");
  useEffect(() => {
    setSelectedMake(make || "");
  }, [make]);

  useEffect(() => {
    async function loadCars() {
      const response = await fetch("/api/cars", { cache: "no-store" });
      const payload = await response.json();
      setCars(Array.isArray(payload?.cars) ? payload.cars : []);
    }
    void loadCars();
  }, []);

  function onSubmit(data: FormData) {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const similar = cars.filter(
          (c) => c.make === data.make && (!data.model || c.model === data.model),
        );
        const base = similar.length > 0
          ? similar.reduce((s, c) => s + c.price, 0) / similar.length
          : 2500000;
        const mileage = parseInt(data.mileage.replace(/\D/g, ""), 10) || 50000;
        const mileagePenalty = Math.max(0, (mileage - 50000) / 200000) * 0.15;
        const adjusted = base * (1 - mileagePenalty);
        setResult({
          low: Math.round(adjusted * 0.92),
          high: Math.round(adjusted * 1.08),
          make: data.make,
          model: data.model,
        });
        resolve();
      }, 800);
    });
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-border bg-background p-8 text-center animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Estimated value</p>
        <h3 className="font-display text-xl font-medium mb-4">{result.make} {result.model}</h3>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="text-center">
            <p className="text-xs text-muted mb-1">Low estimate</p>
            <p className="font-display text-2xl font-semibold">KSh {formatPrice(result.low)}</p>
          </div>
          <div className="text-2xl text-muted">—</div>
          <div className="text-center">
            <p className="text-xs text-muted mb-1">High estimate</p>
            <p className="font-display text-2xl font-semibold text-accent">KSh {formatPrice(result.high)}</p>
          </div>
        </div>
        <p className="text-xs text-muted mb-6">
          Based on {cars.filter((c) => c.make === result.make).length} recent listings. Final offers may vary.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setResult(null)}
            className="h-11 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            Recalculate
          </button>
          <a
            href="#dealer"
            className="h-11 rounded-full bg-accent text-white px-6 text-sm font-semibold flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            Get dealer offers
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-3xl border border-border bg-background p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Year" error={errors.year?.message}>
          <select {...register("year")} className={selectCls(!!errors.year)}>
            <option value="">Select year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </SelectField>

        <SelectField label="Make" error={errors.make?.message}>
          <select {...register("make")} className={selectCls(!!errors.make)}>
            <option value="">Select make</option>
            {brands.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </SelectField>
      </div>

      <SelectField label="Model" error={errors.model?.message}>
        <select {...register("model")} disabled={!selectedMake} className={selectCls(!!errors.model)}>
          <option value="">{selectedMake ? "Select model" : "Pick a make first"}</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </SelectField>

      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Mileage (km)" error={errors.mileage?.message}>
          <select {...register("mileage")} className={selectCls(!!errors.mileage)}>
            <option value="">Select range</option>
            {["0-20,000", "20,000-50,000", "50,000-100,000", "100,000-150,000", "150,000+"].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </SelectField>

        <SelectField label="Location" error={errors.location?.message}>
          <select {...register("location")} className={selectCls(!!errors.location)}>
            <option value="">Select city</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </SelectField>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isSubmitting ? "Calculating…" : "Get free valuation"}
      </button>
    </form>
  );
}

function selectCls(hasError: boolean) {
  return `w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none cursor-pointer transition-colors ${
    hasError ? "border-red-500" : "border-border focus:border-accent"
  }`;
}

function SelectField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}