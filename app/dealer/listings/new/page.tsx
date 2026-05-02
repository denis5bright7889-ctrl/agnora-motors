"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const schema = z.object({
  year: z.coerce.number().min(2000).max(2026),
  make: z.string().min(1, "Make required"),
  model: z.string().min(1, "Model required"),
  trim: z.string().optional(),
  price: z.coerce.number().min(100000, "Minimum price KSh 100,000"),
  mileage: z.coerce.number().min(0),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["auto", "manual"]),
  bodyType: z.enum(["suv", "sedan", "hatchback", "pickup", "coupe", "wagon", "van"]),
  condition: z.enum(["new", "used", "certified", "foreign_used", "locally_used"]),
  location: z.string().min(1, "Location required"),
  description: z.string().min(30, "Description must be at least 30 characters"),
  financingAvailable: z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
  status: z.enum(["active", "draft"]).default("active"),
});

type FormData = z.infer<typeof schema>;

const MAKES = [
  "Toyota", "Mazda", "Nissan", "Mercedes-Benz", "Honda", "BMW",
  "Subaru", "Mitsubishi", "Isuzu", "Land Rover", "Ford", "Volkswagen",
  "Peugeot", "Hyundai", "Kia", "Lexus", "Audi", "Other",
];
const YEARS = Array.from({ length: 27 }, (_, i) => 2026 - i);
const FEATURES_PRESETS = [
  "Sunroof/Moonroof", "Leather Seats", "Rear Camera", "Cruise Control",
  "Push Start", "Keyless Entry", "Heated Seats", "Navigation",
  "Apple CarPlay", "Android Auto", "Blind Spot Monitor", "Lane Assist",
  "360° Camera", "Wireless Charging", "Tow Package", "4WD/AWD",
];

export default function NewListingPage() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function uploadImages(files: FileList) {
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "agnora/cars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) urls.push(json.url);
    }
    setImages((prev) => [...prev, ...urls].slice(0, 10));
    setUploading(false);
  }

  function toggleFeature(f: string) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  function addCustomFeature() {
    const trimmed = customFeature.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures((prev) => [...prev, trimmed]);
      setCustomFeature("");
    }
  }

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/dealer/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, images, features }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => router.push("/dealer/listings"), 1500);
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="font-semibold text-lg">Listing saved!</p>
        <p className="text-sm text-muted">Redirecting to your listings…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full border border-border hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-3xl font-medium">New listing</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ── Images ── */}
        <Section title="Photos" description="Upload up to 10 photos. First photo is the cover.">
          <input
            ref={fileRef as React.RefObject<HTMLInputElement>}
            type="file"
            multiple
            accept="image/*"
            aria-label="Upload car photos"
            className="hidden"
            onChange={(e) => e.target.files && uploadImages(e.target.files)}
          />

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((url, i) => (
              <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
                <Image src={url} alt={`Photo ${i + 1}`} fill sizes="150px" className="object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setImages((p) => p.filter((u) => u !== url))}
                  className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hidden group-hover:flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {images.length < 10 && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted hover:border-accent hover:bg-accent-soft/20 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                <span className="text-xs">{uploading ? "Uploading…" : "Add photos"}</span>
              </button>
            )}
          </div>
        </Section>

        {/* ── Car details ── */}
        <Section title="Car details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Year" error={errors.year?.message}>
              <select {...register("year")} className={selectCls(!!errors.year)}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Field>
            <Field label="Make" error={errors.make?.message}>
              <select {...register("make")} className={selectCls(!!errors.make)}>
                <option value="">Select make</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Model" error={errors.model?.message}>
              <input
                {...register("model")}
                placeholder="e.g. Harrier"
                className={inputCls(!!errors.model)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trim / variant (optional)">
              <input
                {...register("trim")}
                placeholder="e.g. Hybrid Z"
                className={inputCls(false)}
              />
            </Field>
            <Field label="Condition" error={errors.condition?.message}>
              <select {...register("condition")} className={selectCls(!!errors.condition)}>
                <option value="foreign_used">Foreign Used</option>
                <option value="locally_used">Locally Used</option>
                <option value="new">New</option>
                <option value="certified">Certified Pre-Owned</option>
                <option value="used">Used</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (KSh)" error={errors.price?.message}>
              <input
                {...register("price")}
                type="number"
                placeholder="3500000"
                className={inputCls(!!errors.price)}
              />
            </Field>
            <Field label="Mileage (km)" error={errors.mileage?.message}>
              <input
                {...register("mileage")}
                type="number"
                placeholder="45000"
                className={inputCls(!!errors.mileage)}
              />
            </Field>
            <Field label="Location" error={errors.location?.message}>
              <select {...register("location")} className={selectCls(!!errors.location)}>
                <option value="">Select city</option>
                {["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fuel type" error={errors.fuel?.message}>
              <select {...register("fuel")} className={selectCls(!!errors.fuel)}>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
            </Field>
            <Field label="Transmission" error={errors.transmission?.message}>
              <select {...register("transmission")} className={selectCls(!!errors.transmission)}>
                <option value="auto">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Body type" error={errors.bodyType?.message}>
              <select {...register("bodyType")} className={selectCls(!!errors.bodyType)}>
                <option value="suv">SUV</option>
                <option value="sedan">Sedan</option>
                <option value="hatchback">Hatchback</option>
                <option value="pickup">Pickup</option>
                <option value="wagon">Wagon</option>
                <option value="coupe">Coupe</option>
                <option value="van">Van</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Description ── */}
        <Section title="Description">
          <Field label="Describe this car" error={errors.description?.message}>
            <textarea
              {...register("description")}
              rows={5}
              placeholder="Include condition details, import history, service records, notable features, and any known issues…"
              className={cn(inputCls(!!errors.description), "resize-none")}
            />
          </Field>
        </Section>

        {/* ── Finance options ── */}
        <Section title="Finance options">
          <p className="text-xs text-muted mb-3">Let buyers know if this car is available through financing or hire purchase arrangements.</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("financingAvailable")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium">Financing available</p>
                <p className="text-xs text-muted">Buyer can purchase this car through a bank loan or SACCO financing.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("hirePurchaseAvailable")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium">Hire purchase available</p>
                <p className="text-xs text-muted">Buyer can acquire this car through a hire purchase agreement.</p>
              </div>
            </label>
          </div>
        </Section>

        {/* ── Features ── */}
        <Section title="Features & equipment">
          <div className="flex flex-wrap gap-2 mb-4">
            {FEATURES_PRESETS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFeature(f)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-all",
                  features.includes(f)
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:border-accent/50",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customFeature}
              onChange={(e) => setCustomFeature(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(); }}}
              placeholder="Add custom feature…"
              className={inputCls(false)}
            />
            <button
              type="button"
              onClick={addCustomFeature}
              className="h-11 px-4 rounded-xl border border-border text-sm font-medium hover:bg-surface-2 transition-colors whitespace-nowrap"
            >
              Add
            </button>
          </div>
          {features.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {features.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1.5 h-7 rounded-full bg-accent-soft border border-accent/20 px-3 text-xs text-accent"
                >
                  {f}
                  <button type="button" onClick={() => toggleFeature(f)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* ── Publish ── */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            name="status"
            value="active"
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              "Publish listing"
            )}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={() => {
              // Override to draft before submit
            }}
            className="h-12 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            Save as draft
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted",
    hasError ? "border-red-500" : "border-border focus:border-accent",
  );
}

function selectCls(hasError: boolean) {
  return cn(inputCls(hasError), "cursor-pointer");
}
