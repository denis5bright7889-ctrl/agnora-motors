"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Upload, X, Loader2, CheckCircle2, ArrowLeft, ArrowRight,
  AlertCircle, Star, MapPin, Gauge, Fuel, Settings, Car as CarIcon,
  Check, Lock, ShieldCheck, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Schema (same fields, kept as a single form to preserve values across steps) ──
const schema = z.object({
  sellerName:  z.string().min(2, "Your name is required"),
  sellerPhone: z.string().min(9, "A valid phone number is required"),
  year:        z.coerce.number().min(1990).max(2026),
  make:        z.string().min(1, "Make required"),
  model:       z.string().min(1, "Model required"),
  trim:        z.string().optional(),
  price:       z.coerce.number().min(100_000, "Minimum price KSh 100,000"),
  mileage:     z.coerce.number().min(0),
  fuel:         z.enum(["petrol", "diesel", "hybrid", "electric"]),
  transmission: z.enum(["auto", "manual"]),
  bodyType:     z.enum(["suv", "sedan", "hatchback", "pickup", "coupe", "wagon", "van"]),
  condition:    z.enum(["new", "used", "certified", "foreign_used", "locally_used"]),
  location:    z.string().min(1, "Location required"),
  description: z.string().min(30, "Description must be at least 30 characters"),
  vin: z.string()
    .min(11, "VIN must be 11–20 characters")
    .max(20, "VIN must be 11–20 characters"),
  financingAvailable:    z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

const MIN_PHOTOS = 10;
const MAX_PHOTOS = 10;
const DRAFT_KEY  = "agnora:sell-new:images";

// Fields validated by trigger() on each step's Continue button. Anything not
// in these arrays simply isn't checked until the final submit (e.g. boolean
// finance flags don't need validation).
const STEP_FIELDS: Record<0 | 1 | 2, (keyof FormData)[]> = {
  0: ["year", "make", "model", "trim", "condition", "mileage",
      "fuel", "transmission", "bodyType", "vin", "description"],
  1: ["price", "location"],
  2: ["sellerName", "sellerPhone"],
};

const STEP_META = [
  { title: "Your car",         subtitle: "What you're selling" },
  { title: "Photos & price",   subtitle: "Show it off, name your number" },
  { title: "How buyers reach you", subtitle: "We send messages to you directly" },
] as const;

type UploadStatus = "uploading" | "uploaded" | "failed";
interface ListingImage {
  id: string;
  previewUrl: string;
  uploadedUrl?: string;
  status: UploadStatus;
  error?: string;
  file?: File;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MAKES = [
  "Toyota", "Mazda", "Nissan", "Mercedes-Benz", "Honda", "BMW",
  "Subaru", "Mitsubishi", "Isuzu", "Land Rover", "Ford", "Volkswagen",
  "Peugeot", "Hyundai", "Kia", "Lexus", "Audi", "Other",
];
const YEARS = Array.from({ length: 37 }, (_, i) => 2026 - i);
const FEATURES_PRESETS = [
  "Sunroof/Moonroof", "Leather Seats", "Rear Camera", "Cruise Control",
  "Push Start", "Keyless Entry", "Heated Seats", "Navigation",
  "Apple CarPlay", "Android Auto", "Blind Spot Monitor", "Lane Assist",
  "360° Camera", "Wireless Charging", "Tow Package", "4WD/AWD",
];
const CITIES = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Other"];

const CONDITION_LABEL: Record<FormData["condition"], string> = {
  foreign_used: "Foreign Used",
  locally_used: "Locally Used",
  new:          "New",
  certified:    "Certified Pre-Owned",
  used:         "Used",
};

// ════════════════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════════════════

export default function PublicListingPage() {
  const router = useRouter();
  const [step, setStep]               = useState<0 | 1 | 2>(0);
  const [images, setImages]           = useState<ListingImage[]>([]);
  const [features, setFeatures]       = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadedCount  = images.filter((i) => i.status === "uploaded").length;
  const isAnyUploading = images.some((i)  => i.status === "uploading");
  const failedCount    = images.filter((i) => i.status === "failed").length;
  const photosReady    = uploadedCount >= MIN_PHOTOS && !isAnyUploading;

  const {
    register, control, trigger, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Keep values across step transitions even when fields are unmounted.
    shouldUnregister: false,
    defaultValues: {
      year: 2024, fuel: "petrol", transmission: "auto", bodyType: "suv",
      condition: "foreign_used", financingAvailable: false, hirePurchaseAvailable: false,
    },
  });

  // Reactive snapshot of every field so the live preview re-renders as the
  // user types. Cheap because react-hook-form already tracks the values.
  const watched = useWatch({ control });

  // ── localStorage: hydrate uploaded URLs from a previous draft ─────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const urls = JSON.parse(raw) as unknown;
      if (!Array.isArray(urls)) return;
      const restored: ListingImage[] = urls
        .filter((u): u is string => typeof u === "string")
        .slice(0, MAX_PHOTOS)
        .map((url) => ({
          id: newId(),
          previewUrl: url,
          uploadedUrl: url,
          status: "uploaded" as UploadStatus,
        }));
      if (restored.length > 0) setImages(restored);
    } catch { /* ignore */ }
  }, []);

  // ── localStorage: persist on every state change ───────────────────────────
  useEffect(() => {
    try {
      const urls = images.filter((i) => i.uploadedUrl).map((i) => i.uploadedUrl!);
      if (urls.length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(urls));
      else                 localStorage.removeItem(DRAFT_KEY);
    } catch { /* ignore */ }
  }, [images]);

  // ── Revoke blob: URLs on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      images.forEach((i) => {
        if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Photo lifecycle ───────────────────────────────────────────────────────
  async function uploadOne(id: string, file: File) {
    setImages((prev) => prev.map((i) =>
      i.id === id ? { ...i, status: "uploading", error: undefined } : i,
    ));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "agnora/cars");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? `HTTP ${res.status}`);
      setImages((prev) => prev.map((i) =>
        i.id === id ? { ...i, status: "uploaded", uploadedUrl: json.url } : i,
      ));
    } catch (e) {
      setImages((prev) => prev.map((i) =>
        i.id === id ? { ...i, status: "failed", error: e instanceof Error ? e.message : "Upload failed" } : i,
      ));
    }
  }

  function onFilesSelected(files: FileList) {
    setError("");
    const remaining = Math.max(0, MAX_PHOTOS - images.length);
    if (remaining === 0) return;
    const fresh: ListingImage[] = Array.from(files).slice(0, remaining).map((file) => ({
      id: newId(),
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      file,
    }));
    if (fresh.length === 0) return;
    setImages((prev) => [...prev, ...fresh]);
    fresh.forEach((item) => void uploadOne(item.id, item.file!));
  }

  function retryImage(id: string) {
    const item = images.find((i) => i.id === id);
    if (!item?.file) { removeImage(id); return; }
    void uploadOne(id, item.file);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function setAsCover(id: string) {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      return [item, ...prev.filter((i) => i.id !== id)];
    });
  }

  function toggleFeature(f: string) {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }
  function addCustomFeature() {
    const trimmed = customFeature.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures((prev) => [...prev, trimmed]);
      setCustomFeature("");
    }
  }

  // ── Step navigation ───────────────────────────────────────────────────────
  async function goNext() {
    setError("");
    const ok = await trigger(STEP_FIELDS[step]);
    if (!ok) return;
    // Step 1 has an extra non-form gate: enough uploaded photos.
    if (step === 1 && !photosReady) {
      setError(
        isAnyUploading
          ? "Hang on — some photos are still uploading."
          : `Please upload at least ${MIN_PHOTOS} photos before continuing.`,
      );
      return;
    }
    setStep((s) => (Math.min(2, s + 1) as 0 | 1 | 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goBack() {
    setError("");
    setStep((s) => (Math.max(0, s - 1) as 0 | 1 | 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    setError("");
    const imageUrls = images
      .filter((i) => i.status === "uploaded" && i.uploadedUrl)
      .map((i) => i.uploadedUrl!);
    if (imageUrls.length < MIN_PHOTOS) {
      setError(`Please upload at least ${MIN_PHOTOS} photos before publishing.`);
      setStep(1);
      return;
    }
    const res = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, images: imageUrls, features }),
    });
    if (res.ok) {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      images.forEach((i) => { if (i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl); });
      setSaved(true);
      setTimeout(() => router.push("/cars"), 1600);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not publish your listing. Please try again.");
    }
  }

  if (saved) {
    return (
      <div className="grain min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight">
          Your car is live.
        </h1>
        <p className="text-sm text-muted">Taking you to the listings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="grain border-b border-border">
        <div className="container max-w-container px-4 py-10 lg:py-16">
          <button
            type="button"
            onClick={() => router.push("/sell")}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-medium leading-[1.02] tracking-tight max-w-3xl">
            List your car in under{" "}
            <span className="italic text-accent">four minutes.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base lg:text-lg text-muted leading-relaxed">
            No account. No password. No spam. Just the details buyers need
            and how they can reach you.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              Free forever
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-accent" />
              VIN-verified listings only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" />
              Live preview as you type
            </span>
          </div>
        </div>
      </header>

      {/* ── Body: form (left) + live preview (right, lg+) ─────────────── */}
      <div className="container max-w-container px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* ─── Left: stepper + step content ─────────────────────────── */}
          <div className="min-w-0">
            <StepIndicator current={step} />

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Step heading — same hierarchy for each step */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">
                  Step {step + 1} of 3
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-medium tracking-tight">
                  {STEP_META[step].title}
                </h2>
                <p className="mt-1 text-sm text-muted">{STEP_META[step].subtitle}</p>
              </div>

              {/* ── Step 0: Car details ── */}
              <div className={cn("space-y-5", step !== 0 && "hidden")}>
                <Card>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Year" error={errors.year?.message}>
                      <select {...register("year")} className={selectCls(!!errors.year)}>
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </Field>
                    <Field label="Make" error={errors.make?.message}>
                      <select {...register("make")} className={selectCls(!!errors.make)}>
                        <option value="">Select make</option>
                        {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="Model" error={errors.model?.message}>
                      <input {...register("model")} placeholder="e.g. Harrier" className={inputCls(!!errors.model)} />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Trim / variant (optional)">
                      <input {...register("trim")} placeholder="e.g. Hybrid Z" className={inputCls(false)} />
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

                  <Field label="VIN / chassis number" error={errors.vin?.message}>
                    <input
                      {...register("vin")}
                      placeholder="e.g. JTMBFREV40D012345"
                      maxLength={20}
                      className={cn(inputCls(!!errors.vin), "uppercase tracking-wider")}
                    />
                    <p className="mt-1.5 text-xs text-muted leading-relaxed">
                      Look on the logbook, lower windshield, driver's door frame, or insurance documents. 11–20 characters.
                    </p>
                  </Field>
                </Card>

                <Card>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Mileage (km)" error={errors.mileage?.message}>
                      <input {...register("mileage")} type="number" placeholder="45000" className={inputCls(!!errors.mileage)} />
                    </Field>
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
                  </div>
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
                </Card>

                <Card>
                  <Field label="Description" error={errors.description?.message}>
                    <textarea
                      {...register("description")}
                      rows={5}
                      placeholder="Condition, import history, service records, notable features, any known issues. The more honest, the faster it sells."
                      className={cn(inputCls(!!errors.description), "resize-none py-3 leading-relaxed")}
                    />
                  </Field>
                </Card>
              </div>

              {/* ── Step 1: Photos & price ── */}
              <div className={cn("space-y-5", step !== 1 && "hidden")}>
                <Card>
                  <input
                    ref={fileRef as React.RefObject<HTMLInputElement>}
                    type="file"
                    multiple
                    accept="image/*"
                    aria-label="Upload car photos"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) onFilesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  {/* Counter chip + progress bar */}
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 text-xs font-medium",
                        photosReady ? "text-green-600 dark:text-green-400" : "text-muted",
                      )}
                    >
                      <span>
                        <span className="font-display text-2xl font-medium tracking-tight text-foreground tabular-nums">
                          {uploadedCount}
                        </span>
                        <span className="text-muted"> / {MIN_PHOTOS} photos</span>
                        {isAnyUploading && <span className="text-muted"> · uploading…</span>}
                        {failedCount > 0 && <span className="text-red-500"> · {failedCount} failed</span>}
                      </span>
                      <span className="uppercase tracking-widest">
                        {photosReady ? "Ready" : `${Math.max(0, MIN_PHOTOS - uploadedCount)} more`}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          photosReady ? "bg-green-500" : "bg-accent",
                        )}
                        style={{ width: `${Math.min(100, (uploadedCount / MIN_PHOTOS) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 mt-4">
                    {images.map((img, i) => {
                      const src = img.uploadedUrl ?? img.previewUrl;
                      return (
                        <div
                          key={img.id}
                          className="relative aspect-[4/3] rounded-xl overflow-hidden group bg-surface-2 ring-1 ring-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Photo ${i + 1}`}
                            loading="lazy"
                            className={cn(
                              "absolute inset-0 h-full w-full object-cover",
                              img.status === "uploading" && "opacity-60",
                              img.status === "failed"    && "opacity-30",
                            )}
                          />

                          {img.status === "uploading" && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}

                          {img.status === "failed" && (
                            <button
                              type="button"
                              onClick={() => retryImage(img.id)}
                              title={img.error ?? "Upload failed"}
                              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-red-500/85 text-white text-[10px] font-semibold text-center px-2"
                            >
                              <AlertCircle className="h-4 w-4" />
                              Tap to retry
                            </button>
                          )}

                          {i === 0 && img.status === "uploaded" && (
                            <span className="absolute left-1.5 top-1.5 z-20 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                              Cover
                            </span>
                          )}

                          {i !== 0 && img.status === "uploaded" && (
                            <button
                              type="button"
                              aria-label="Make this the cover photo"
                              title="Make cover"
                              onClick={() => setAsCover(img.id)}
                              className="absolute left-1.5 top-1.5 z-20 h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hidden group-hover:flex"
                            >
                              <Star className="h-3 w-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            aria-label={`Remove photo ${i + 1}`}
                            onClick={() => removeImage(img.id)}
                            className="absolute right-1.5 top-1.5 z-20 h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hidden group-hover:flex"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    {images.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted hover:border-accent hover:bg-accent-soft/30 hover:text-accent transition-all"
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-[11px] font-medium uppercase tracking-widest">
                          {images.length === 0 ? "Add photos" : "Add more"}
                        </span>
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-muted leading-relaxed">
                    Aim for a clear front 3/4 shot, the dashboard, both interiors, wheels and the engine bay.
                    The first photo is the cover — drag a star onto any other photo to swap.
                  </p>
                </Card>

                <Card>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Asking price (KSh)" error={errors.price?.message}>
                      <input
                        {...register("price")}
                        type="number"
                        placeholder="3500000"
                        className={cn(inputCls(!!errors.price), "font-display text-xl tracking-tight")}
                      />
                    </Field>
                    <Field label="Location" error={errors.location?.message}>
                      <select {...register("location")} className={selectCls(!!errors.location)}>
                        <option value="">Select city</option>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                      Finance options
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-surface-2 px-4 py-3 hover:border-accent/40 transition-colors">
                        <input type="checkbox" {...register("financingAvailable")} className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
                        <div>
                          <p className="text-sm font-medium">Financing available</p>
                          <p className="text-xs text-muted leading-relaxed">Buyer can purchase through a bank loan or SACCO financing.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-surface-2 px-4 py-3 hover:border-accent/40 transition-colors">
                        <input type="checkbox" {...register("hirePurchaseAvailable")} className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer" />
                        <div>
                          <p className="text-sm font-medium">Hire purchase available</p>
                          <p className="text-xs text-muted leading-relaxed">Buyer can acquire through a hire purchase agreement.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                      Features & equipment
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {FEATURES_PRESETS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggleFeature(f)}
                          className={cn(
                            "h-8 rounded-full border px-3 text-xs font-medium transition-all",
                            features.includes(f)
                              ? "border-accent bg-accent text-white"
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
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(); } }}
                        placeholder="Add custom feature…"
                        className={inputCls(false)}
                      />
                      <button
                        type="button"
                        onClick={addCustomFeature}
                        className="h-11 px-5 rounded-xl border border-border text-sm font-medium hover:bg-surface-2 transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* ── Step 2: Contact ── */}
              <div className={cn("space-y-5", step !== 2 && "hidden")}>
                <Card>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full name" error={errors.sellerName?.message}>
                      <input {...register("sellerName")} placeholder="e.g. Jane Mwangi" className={inputCls(!!errors.sellerName)} />
                    </Field>
                    <Field label="Phone number" error={errors.sellerPhone?.message}>
                      <input {...register("sellerPhone")} type="tel" placeholder="+254 7XX XXX XXX" className={inputCls(!!errors.sellerPhone)} />
                    </Field>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Buyers see your phone number on the listing so they can call or WhatsApp you directly.
                    Use a number you check often — fast replies sell cars.
                  </p>
                </Card>

                <Card>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                    Final check
                  </p>
                  <SummaryRow label="Car"   value={[watched.year, watched.make, watched.model].filter(Boolean).join(" ") || "—"} />
                  <SummaryRow label="VIN"   value={watched.vin || "—"} />
                  <SummaryRow label="Price" value={watched.price ? `KSh ${Number(watched.price).toLocaleString()}` : "—"} />
                  <SummaryRow label="Photos" value={`${uploadedCount} / ${MIN_PHOTOS}`} />
                  <SummaryRow label="Location" value={watched.location || "—"} />
                </Card>
              </div>

              {/* ── Nav buttons ── */}
              <div className="flex items-center justify-between gap-3 pt-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-2 h-12 rounded-full border border-border px-5 text-sm font-semibold hover:bg-surface-2 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                ) : (
                  <Link
                    href="/sell"
                    className="inline-flex items-center gap-2 h-12 rounded-full border border-border px-5 text-sm font-semibold text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </Link>
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background px-7 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || !photosReady}
                    className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 h-12 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>
                      : <>Publish listing <ArrowRight className="h-4 w-4" /></>}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ─── Right: live preview pane (lg+) ───────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Preview — what buyers will see
              </p>
              <LivePreview values={watched as Partial<FormData>} images={images} features={features} />
              <p className="text-xs text-muted leading-relaxed mt-3">
                Updates as you type. Photos appear here the moment they upload.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 sm:gap-4">
        {STEP_META.map((meta, i) => {
          const done    = i < current;
          const active  = i === current;
          return (
            <div key={i} className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-medium transition-all",
                  done   && "bg-green-500 text-white",
                  active && "bg-accent text-white scale-110 shadow-lg shadow-accent/30",
                  !done && !active && "bg-surface-2 text-muted",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden sm:block text-xs font-semibold uppercase tracking-widest truncate",
                  active ? "text-foreground" : "text-muted",
                )}
              >
                {meta.title}
              </span>
              {i < STEP_META.length - 1 && (
                <div className={cn("flex-1 h-px transition-colors", done ? "bg-green-500" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LivePreview({
  values, images, features,
}: {
  values: Partial<FormData>;
  images: ListingImage[];
  features: string[];
}) {
  const cover = images.find((i) => i.status === "uploaded") ?? images[0];
  const coverSrc = cover ? (cover.uploadedUrl ?? cover.previewUrl) : null;
  const uploadedTotal = images.filter((i) => i.status === "uploaded").length;

  const heading = [values.year, values.make, values.model].filter(Boolean).join(" ") || "Your car";
  const trim    = values.trim?.trim();
  const stats   = [
    values.mileage  ? `${Number(values.mileage).toLocaleString()} km` : null,
    values.bodyType ? capitalize(values.bodyType) : null,
    values.transmission === "auto" ? "Automatic" : values.transmission === "manual" ? "Manual" : null,
    values.fuel ? capitalize(values.fuel) : null,
  ].filter(Boolean).join(" · ");

  const condition = values.condition ? CONDITION_LABEL[values.condition] : null;
  const price     = values.price ? `Ksh ${Number(values.price).toLocaleString()}` : "Ksh —";

  return (
    <div className="rounded-3xl border border-border bg-surface shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden">
      {/* Cover image */}
      <div className="relative aspect-[4/3] bg-surface-2">
        {coverSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverSrc} alt="Cover preview" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              Photo 1 of {uploadedTotal || 1}
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
            <CarIcon className="h-10 w-10 opacity-50" />
            <span className="text-xs">Add photos to preview</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        <p className="font-display text-3xl font-medium tracking-tight leading-none">
          {price}
        </p>
        <h3 className="font-display text-xl font-medium tracking-tight leading-tight">
          {heading}
          {trim && <span className="text-muted font-normal text-base ml-1.5">· {trim}</span>}
        </h3>

        {stats && (
          <p className="text-xs text-muted leading-relaxed">{stats}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {condition && <Pill>{condition}</Pill>}
          {values.financingAvailable && <Pill>Financing</Pill>}
          {values.hirePurchaseAvailable && <Pill>Hire purchase</Pill>}
        </div>

        {features.length > 0 && (
          <p className="text-[11px] text-muted leading-relaxed">
            <span className="font-medium text-foreground">{features.length}</span> feature{features.length === 1 ? "" : "s"} ·{" "}
            {features.slice(0, 3).join(" · ")}
            {features.length > 3 && ` · +${features.length - 3} more`}
          </p>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <MapPin className="h-3.5 w-3.5" />
            {values.location || "—"}
          </span>
          <span className="text-muted">Posted just now</span>
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
      {children}
    </div>
  );
}

function Field({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</span>
      <span className="text-sm font-medium text-foreground text-right truncate max-w-[60%]">{value}</span>
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
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
