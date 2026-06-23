"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
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
  // PR4b — all optional. preprocess turns empty <input> strings into undefined
  // so an unfilled field doesn't trip the numeric/enum validators.
  drivetrain:     z.preprocess((v) => v === "" ? undefined : v, z.enum(["fwd","rwd","awd","4wd"]).optional()),
  engineSizeL:    z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().min(0.5).max(8.0).optional()),
  previousOwners: z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().int().min(0).max(20).optional()),
  exteriorColor:  z.preprocess((v) => v === "" ? undefined : v, z.string().max(40).optional()),
  interiorColor:  z.preprocess((v) => v === "" ? undefined : v, z.string().max(40).optional()),
  // PR6b — VIN + trust flags.
  vin:                      z.preprocess((v) => v === "" ? undefined : v, z.string().min(11).max(20).optional()),
  vinVerified:              z.boolean().default(false),
  serviceHistoryAvailable:  z.boolean().default(false),
  ownershipVerified:        z.boolean().default(false),
  inspectionAvailable:      z.boolean().default(false),
  // 2026-06-22 trust fields — fraud-prevention + buyer-trust signals.
  registrationNumber:       z.preprocess((v) => v === "" ? undefined : v, z.string().min(4).max(15).optional()),
  mileageVerified:          z.boolean().default(false),
  logbookVerified:          z.boolean().default(false),
  accidentHistory:          z.preprocess((v) => v === "" ? undefined : v, z.enum(["none","minor_repaired","major_repaired","unknown"]).optional()),
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
const EXTERIOR_COLORS = [
  "Black","White","Silver","Gray","Red","Blue","Green","Beige","Brown","Yellow",
];
const INTERIOR_COLORS = ["Black","Gray","Beige","Brown","White","Red"];

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

  const [serverError, setServerError] = useState<string>("");
  const [intendedStatus, setIntendedStatus] = useState<"active" | "draft">("active");

  async function onSubmit(data: FormData) {
    setServerError("");
    const payload = { ...data, images, features, status: intendedStatus };
    const res = await fetch("/api/dealer/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Failed to save listing. Please try again.");
      return;
    }
    setSaved(true);
    setTimeout(() => router.push("/dealer/listings"), 1500);
  }

  // PR7: publishing requires the photo quality bar. VIN is validated server-side.
  const MIN_PUBLISH_PHOTOS = 10;
  const photosNeeded       = Math.max(0, MIN_PUBLISH_PHOTOS - images.length);
  const publishBlocked     = photosNeeded > 0;

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
        <Section
          title="Photos"
          description={
            `Upload up to 10 photos. First photo is the cover. ` +
            `Publishing requires at least ${MIN_PUBLISH_PHOTOS} — ` +
            (images.length >= MIN_PUBLISH_PHOTOS
              ? "you're ready to publish."
              : `${photosNeeded} more to go.`)
          }
        >
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
              <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden group bg-surface-2">
                {/* Plain <img>: previews must work for any upload URL without
                    depending on next.config remotePatterns. Same fix we applied
                    to /sell/new. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setImages((p) => p.filter((u) => u !== url))}
                  className="absolute right-1.5 top-1.5 z-10 h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hidden group-hover:flex"
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

        {/* ── Specifications (PR4b) ── */}
        <Section title="Specifications" description="Optional but strongly recommended — buyers filter by these.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Drivetrain">
              <select {...register("drivetrain")} className={selectCls(false)}>
                <option value="">Not specified</option>
                <option value="fwd">FWD — Front-wheel drive</option>
                <option value="rwd">RWD — Rear-wheel drive</option>
                <option value="awd">AWD — All-wheel drive</option>
                <option value="4wd">4WD — Four-wheel drive</option>
              </select>
            </Field>
            <Field label="Engine size (L)" error={errors.engineSizeL?.message as string | undefined}>
              <input
                {...register("engineSizeL")}
                type="number"
                step="0.1"
                placeholder="e.g. 2.0"
                className={inputCls(!!errors.engineSizeL)}
              />
            </Field>
            <Field label="Previous owners" error={errors.previousOwners?.message as string | undefined}>
              <input
                {...register("previousOwners")}
                type="number"
                placeholder="e.g. 1"
                className={inputCls(!!errors.previousOwners)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exterior color">
              <select {...register("exteriorColor")} className={selectCls(false)}>
                <option value="">Not specified</option>
                {EXTERIOR_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Interior color">
              <select {...register("interiorColor")} className={selectCls(false)}>
                <option value="">Not specified</option>
                {INTERIOR_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Verification (PR6b) ── */}
        <Section
          title="Verification & trust"
          description="Optional. Filled-in trust fields earn Agnora's trust badges and surface in buyer search filters."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="VIN / chassis number" error={errors.vin?.message as string | undefined}>
              <input
                {...register("vin")}
                placeholder="17-character VIN or chassis number"
                className={inputCls(!!errors.vin)}
                maxLength={20}
              />
            </Field>

            <Field
              label="Registration number"
              error={errors.registrationNumber?.message as string | undefined}
            >
              <input
                {...register("registrationNumber")}
                placeholder="e.g. KDM 123A"
                className={inputCls(!!errors.registrationNumber)}
                maxLength={15}
              />
              <p className="mt-1 text-[10px] text-muted">
                Private — never shown on the public listing. Used for duplicate detection &amp; fraud prevention.
              </p>
            </Field>
          </div>

          {/* Accident history — honest radio. "None" gets a positive badge on
              the listing; anything repaired shows a transparent indicator. */}
          <Field label="Accident history">
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              {[
                { value: "none",            label: "No known accidents",        hint: "Earns the \"Accident-free\" badge on the listing." },
                { value: "minor_repaired",  label: "Minor accident repaired",   hint: "Cosmetic or non-structural damage repaired." },
                { value: "major_repaired",  label: "Major accident repaired",   hint: "Structural / frame work was carried out." },
                { value: "unknown",         label: "Unknown / not declared",    hint: "Selected if you can't confirm the history." },
              ].map(({ value, label, hint }) => (
                <label
                  key={value}
                  className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 cursor-pointer hover:border-accent/40 transition-colors"
                >
                  <input
                    type="radio"
                    value={value}
                    {...register("accidentHistory")}
                    className="mt-1 h-4 w-4 accent-accent shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-[11px] text-muted leading-snug">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <div className="space-y-2.5 mt-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("vinVerified")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">VIN verified by Agnora</p>
                <p className="text-xs text-muted">Tick only after Agnora staff confirms the VIN matches the logbook.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("mileageVerified")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">Mileage verified</p>
                <p className="text-xs text-muted">Odometer cross-checked against service records or auction sheet.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("logbookVerified")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">Logbook verified</p>
                <p className="text-xs text-muted">Original logbook sighted and matches the registration number above.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("inspectionAvailable")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">Independent inspection available</p>
                <p className="text-xs text-muted">Buyer can request a third-party pre-purchase inspection.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("serviceHistoryAvailable")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">Service history available</p>
                <p className="text-xs text-muted">You can provide complete or near-complete service records.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register("ownershipVerified")}
                className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
              <div>
                <p className="text-sm font-medium">Ownership verified</p>
                <p className="text-xs text-muted">Logbook + ID confirm current ownership matches the listing.</p>
              </div>
            </label>
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
        {serverError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
            <X className="h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-4">
            <button
              type="submit"
              onClick={() => setIntendedStatus("active")}
              disabled={isSubmitting || publishBlocked}
              className="flex-1 h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && intendedStatus === "active" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                "Publish listing"
              )}
            </button>
            <button
              type="submit"
              onClick={() => setIntendedStatus("draft")}
              disabled={isSubmitting}
              className="h-12 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-60"
            >
              {isSubmitting && intendedStatus === "draft" ? "Saving…" : "Save as draft"}
            </button>
          </div>
          {publishBlocked && (
            <p className="text-xs text-muted">
              Add {photosNeeded} more photo{photosNeeded === 1 ? "" : "s"} to publish. You can save as a draft now and finish later.
            </p>
          )}
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
