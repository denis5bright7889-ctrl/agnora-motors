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
  Check, Lock, ShieldCheck, Zap, ChevronDown, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type { DecodedVehicle } from "@/lib/vin-decoder";

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
  // Optional typed cols already in the cars table — exposed via Technical
  // specifications panel below.
  drivetrain:     z.enum(["fwd", "rwd", "awd", "4wd"]).optional().or(z.literal("")),
  previousOwners: optionalNum(0, 20),
  exteriorColor:  z.string().max(40).optional(),
  interiorColor:  z.string().max(40).optional(),
  financingAvailable:    z.boolean().default(false),
  hirePurchaseAvailable: z.boolean().default(false),
  // Optional buyer-decision specs — every field independently optional.
  // Conditional UI shows only the relevant ones based on fuel + body type.
  // Numbers are nullable-on-blank: react-hook-form gives "" for an empty
  // number input, so coerce to undefined before validation.
  specifications: z.object({
    engineCc:           optionalNum(50, 20_000),
    horsepower:         optionalNum(20, 2_500),
    torqueNm:           optionalNum(20, 5_000),
    fuelEconomyKmL:     optionalNum(1, 100, true),
    batteryCapacityKwh: optionalNum(1, 500, true),
    rangeKm:            optionalNum(20, 2_000),
    chargingTimeHours:  optionalNum(0.1, 72, true),
    seats:              optionalNum(1, 60),
    payloadKg:          optionalNum(50, 50_000),
    towingCapacityKg:   optionalNum(50, 50_000),
    upholstery:         z.enum(["cloth", "leather", "leatherette", "alcantara"]).optional().or(z.literal("")),
  }).default({}),
});

/** Number field that treats empty string as "not provided". */
function optionalNum(min: number, max: number, allowFloat = false) {
  const base = allowFloat ? z.number() : z.number().int();
  return z.preprocess(
    (v) => (v === "" || v == null) ? undefined : Number(v),
    base.min(min).max(max).optional(),
  );
}

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
  { title: "Vehicle details", subtitle: "Tell us about the car you're selling" },
  { title: "Photos & price",  subtitle: "Show it off, name your number" },
  { title: "Contact details", subtitle: "How interested buyers will reach you" },
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
  const [techOpen, setTechOpen]       = useState(false);
  // VIN decoder state. `decode` is the result of the last attempt (null
  // before first attempt), `decoding` is the in-flight flag.
  const [decoding, setDecoding]       = useState(false);
  const [decode, setDecode]           = useState<null | { decoded: boolean; source: string; fields: DecodedVehicle; applied: string[] }>(null);
  const [decodeError, setDecodeError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadedCount  = images.filter((i) => i.status === "uploaded").length;
  const isAnyUploading = images.some((i)  => i.status === "uploading");
  const failedCount    = images.filter((i) => i.status === "failed").length;
  const photosReady    = uploadedCount >= MIN_PHOTOS && !isAnyUploading;

  const {
    register, control, trigger, handleSubmit, getValues, setValue,
    formState: { errors, isSubmitting, dirtyFields },
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

  // ── VIN decoder ─────────────────────────────────────────────────────────
  // Calls /api/vin/decode and AUTO-applies the result to any empty fields
  // immediately. The "Apply" button click is gone — the decoder is faster
  // now, but we preserve the "never overwrite a manual edit" rule: only
  // fields the seller hasn't touched get filled. The banner shows what
  // happened rather than what could happen.
  async function decodeVinNow() {
    const vin = (getValues("vin") ?? "").trim();
    if (vin.length < 11 || vin.length > 20) {
      setDecodeError("Enter the full VIN (11–20 characters) before decoding.");
      return;
    }
    setDecoding(true);
    setDecode(null);
    setDecodeError("");
    trackEvent("vin_decode_attempted", { vinLength: vin.length });
    try {
      const res  = await fetch(`/api/vin/decode?vin=${encodeURIComponent(vin)}`);
      const json = await res.json();
      if (!res.ok) {
        setDecodeError(json?.error ?? "VIN decoder unavailable. You can still fill in the fields manually.");
        return;
      }
      const result = {
        decoded: !!json.decoded,
        source:  String(json.source ?? "manual"),
        fields:  (json.fields ?? {}) as DecodedVehicle,
      };
      trackEvent("vin_decode_succeeded", {
        source:        result.source,
        matchedFields: Object.keys(result.fields),
      });

      // On a successful match: auto-apply right away. The seller sees the
      // result in the form fields below the VIN immediately.
      const applied = result.decoded ? applyToEmptyFields(result.fields) : [];
      setDecode({ ...result, applied });
      if (applied.length > 0) {
        trackEvent("vin_decode_applied", { appliedFields: applied });
      }
    } catch {
      setDecodeError("Couldn't reach the VIN decoder. Check your connection and try again.");
    } finally {
      setDecoding(false);
    }
  }

  // Pure helper: writes decoded values into any empty form fields and
  // returns the list of field names that were actually filled. Never
  // overwrites a manual edit. Auto-opens the Technical specifications
  // panel if a spec was applied.
  function applyToEmptyFields(f: DecodedVehicle): string[] {
    const applied: string[] = [];
    const currentSpecs = getValues("specifications") ?? {};

    // "Overwritable" = field is empty OR has a form default the user hasn't
    // touched. react-hook-form's dirtyFields tells us which fields have been
    // modified since the form's defaultValues. A non-dirty field is still
    // showing whatever default we picked — fair game for the decoder.
    const setIfEmpty = (name: keyof FormData, value: unknown) => {
      if (value == null || value === "") return;
      const current = getValues(name);
      const empty   = current == null || current === "" || (typeof current === "number" && Number.isNaN(current));
      const touched = !!dirtyFields[name as keyof typeof dirtyFields];
      if (empty || !touched) {
        setValue(name, value as never, { shouldDirty: true, shouldValidate: true });
        applied.push(name as string);
      }
    };

    setIfEmpty("year",         f.year);
    setIfEmpty("make",         f.make);
    setIfEmpty("model",        f.model);
    setIfEmpty("trim",         f.trim);
    setIfEmpty("bodyType",     f.bodyType);
    setIfEmpty("fuel",         f.fuel);
    setIfEmpty("transmission", f.transmission);
    setIfEmpty("drivetrain",   f.drivetrain);

    // Nested specifications — handle by-key so we don't clobber siblings.
    const nextSpecs = { ...currentSpecs };
    const isEmpty = (v: unknown) => v == null || v === "";
    if (f.engineCc   != null && isEmpty(currentSpecs.engineCc))   { nextSpecs.engineCc   = f.engineCc;   applied.push("specifications.engineCc"); }
    if (f.horsepower != null && isEmpty(currentSpecs.horsepower)) { nextSpecs.horsepower = f.horsepower; applied.push("specifications.horsepower"); }
    if (applied.some((a) => a.startsWith("specifications."))) {
      setValue("specifications", nextSpecs, { shouldDirty: true, shouldValidate: true });
      setTechOpen(true);
    }

    return applied;
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
    // Strip empty-string entries from optional fields so the API's zod schema
    // doesn't see "" where it expects undefined (drivetrain, upholstery, etc).
    const clean = stripEmpty(data);

    const res = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...clean, images: imageUrls, features }),
    });
    if (res.ok) {
      // Track usage of the optional Technical specifications panel so we
      // can tell which fields sellers actually engage with before building
      // more. Count any non-empty value among the JSONB-native + typed-col
      // spec fields the form exposes.
      const specVals = [
        clean.specifications?.engineCc, clean.specifications?.horsepower, clean.specifications?.torqueNm,
        clean.specifications?.fuelEconomyKmL, clean.specifications?.batteryCapacityKwh,
        clean.specifications?.rangeKm, clean.specifications?.chargingTimeHours,
        clean.specifications?.seats, clean.specifications?.payloadKg, clean.specifications?.towingCapacityKg,
        clean.specifications?.upholstery,
        clean.drivetrain, clean.exteriorColor, clean.interiorColor, clean.previousOwners,
      ];
      const filledFields = specVals.filter((v) => v != null && v !== "").length;
      if (filledFields > 0) {
        trackEvent("listing_specifications_completed", {
          filledFields,
          fuelType: clean.fuel,
          bodyType: clean.bodyType,
        });
      }

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

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.05] tracking-tight max-w-3xl">
            Sell your car with confidence —{" "}
            <span className="italic text-accent">reach serious buyers across Kenya.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base lg:text-lg text-muted leading-relaxed">
            Create a trusted listing in minutes. No account required. Upload your
            photos, verify your VIN, and connect directly with ready-to-buy customers.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              Free to list
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-accent" />
              VIN-verified listings
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              Direct buyer enquiries
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent" />
              Live preview as you build
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
              {/* Step heading — combined step counter + section title in one
                  accent label, then a richer descriptive subtitle below. */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">
                  Step {step + 1} of 3 — {STEP_META[step].title}
                </p>
                <p className="font-display text-2xl md:text-3xl font-medium tracking-tight text-foreground">
                  {STEP_META[step].subtitle}
                </p>
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
                    <div className="flex gap-2">
                      <input
                        {...register("vin")}
                        placeholder="e.g. JTMBFREV40D012345"
                        maxLength={20}
                        className={cn(inputCls(!!errors.vin), "uppercase tracking-wider flex-1")}
                      />
                      <button
                        type="button"
                        onClick={decodeVinNow}
                        disabled={decoding}
                        className="h-11 px-4 rounded-xl border border-accent/30 bg-accent-soft text-accent text-xs font-semibold uppercase tracking-widest hover:border-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap"
                        title="Look up year, make, model and other details from the VIN"
                      >
                        {decoding ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Decoding…</>
                        ) : (
                          <><Zap className="h-3.5 w-3.5" /> Decode VIN</>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted leading-relaxed">
                      Find your VIN on the logbook, lower windshield, driver's door
                      frame, or insurance documents. Decoding works best for US-spec
                      cars; JDM imports may need to be filled in manually.
                    </p>

                    {/* Decode error — soft, doesn't block submission */}
                    {decodeError && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{decodeError}</span>
                      </div>
                    )}

                    {/* No-match banner — JDM imports are normal */}
                    {decode && !decode.decoded && (
                      <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted">No public record found</p>
                          <p className="text-xs text-muted mt-0.5 leading-relaxed">
                            That's normal for JDM and other non-US-spec imports. Fill in the fields below manually — your listing is still good to publish.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDecode(null)}
                          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
                          aria-label="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Match banner — confirmation of what was auto-filled.
                        We've already mutated the form by the time this renders. */}
                    {decode && decode.decoded && (
                      <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                              {decode.applied.length > 0
                                ? `${decode.applied.length} field${decode.applied.length === 1 ? "" : "s"} filled from your VIN`
                                : "VIN matched"}
                            </p>
                            <p className="text-sm font-display font-medium mt-0.5 tracking-tight">
                              {[decode.fields.year, decode.fields.make, decode.fields.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                              {decode.fields.trim && <span className="text-muted font-normal ml-1.5">· {decode.fields.trim}</span>}
                            </p>
                            <DecodedFactList fields={decode.fields} />
                            {decode.applied.length > 0 && (
                              <p className="mt-2 text-[11px] text-muted leading-relaxed">
                                Filled: {decode.applied.map(prettyFieldName).join(" · ")}. Review and edit anything that doesn't match.
                              </p>
                            )}
                            {decode.applied.length === 0 && (
                              <p className="mt-2 text-[11px] text-muted leading-relaxed">
                                You'd already filled these fields manually — we didn't overwrite anything.
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDecode(null)}
                            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
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
                      rows={10}
                      placeholder="Condition, import history, service records, notable features, any known issues. The more honest, the faster it sells."
                      // The base inputCls forces h-11 on regular inputs — kill it for the
                      // textarea so the rows / min-h take effect. resize-y lets the seller
                      // drag taller if they want even more room.
                      className={cn(
                        inputCls(!!errors.description),
                        "!h-auto min-h-[240px] sm:min-h-[280px] resize-y py-3 leading-relaxed",
                      )}
                    />
                  </Field>
                </Card>

                {/* ── Technical specifications (optional, collapsed by default) ── */}
                {/* Adds more detail to help buyers compare. Conditional fields show
                    only when the fuel type or body type makes them relevant. */}
                <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTechOpen((o) => !o)}
                    aria-expanded={techOpen ? "true" : "false"}
                    className="w-full flex items-start justify-between gap-3 text-left p-5 sm:p-6 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <Plus className={cn("h-4 w-4 transition-transform", techOpen && "rotate-45")} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">
                          Technical specifications <span className="text-muted font-normal">(optional)</span>
                        </h3>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">
                          Add more details to help buyers compare vehicles.
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("h-5 w-5 text-muted transition-transform shrink-0 mt-1.5", techOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>

                  {techOpen && (
                    <div className="px-5 sm:px-6 pb-6 space-y-6 border-t border-border pt-6">
                      {/* Engine */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Engine</p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          {watched.fuel !== "electric" && (
                            <Field label="Engine capacity (cc)">
                              <input
                                {...register("specifications.engineCc")}
                                type="number"
                                placeholder="2000"
                                className={inputCls(false)}
                              />
                            </Field>
                          )}
                          <Field
                            label="Horsepower (hp)"
                            hint="Higher horsepower generally means quicker acceleration."
                          >
                            <input
                              {...register("specifications.horsepower")}
                              type="number"
                              placeholder="170"
                              className={inputCls(false)}
                            />
                          </Field>
                          <Field
                            label="Torque (Nm)"
                            hint="Higher torque improves towing and low-speed pull."
                          >
                            <input
                              {...register("specifications.torqueNm")}
                              type="number"
                              placeholder="250"
                              className={inputCls(false)}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 mt-4">
                          <Field label="Drivetrain">
                            <select
                              {...register("drivetrain")}
                              className={selectCls(false)}
                            >
                              <option value="">Select drivetrain</option>
                              <option value="fwd">Front-wheel drive (FWD)</option>
                              <option value="rwd">Rear-wheel drive (RWD)</option>
                              <option value="awd">All-wheel drive (AWD)</option>
                              <option value="4wd">4-wheel drive (4WD)</option>
                            </select>
                          </Field>
                          {watched.fuel !== "electric" && (
                            <Field
                              label="Fuel economy (km/L)"
                              hint="Combined urban + highway is fine — round to one decimal."
                            >
                              <input
                                {...register("specifications.fuelEconomyKmL")}
                                type="number"
                                step="0.1"
                                placeholder="14.2"
                                className={inputCls(false)}
                              />
                            </Field>
                          )}
                        </div>
                      </div>

                      {/* Conditional: EV / Hybrid */}
                      {(watched.fuel === "electric" || watched.fuel === "hybrid") && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">
                            {watched.fuel === "electric" ? "Battery & range" : "Hybrid battery"}
                          </p>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Battery capacity (kWh)">
                              <input
                                {...register("specifications.batteryCapacityKwh")}
                                type="number"
                                step="0.1"
                                placeholder="75"
                                className={inputCls(false)}
                              />
                            </Field>
                            <Field label={watched.fuel === "electric" ? "Range (km)" : "EV-only range (km)"}>
                              <input
                                {...register("specifications.rangeKm")}
                                type="number"
                                placeholder="450"
                                className={inputCls(false)}
                              />
                            </Field>
                            {watched.fuel === "electric" && (
                              <Field label="Charging time (hrs, AC)">
                                <input
                                  {...register("specifications.chargingTimeHours")}
                                  type="number"
                                  step="0.1"
                                  placeholder="8"
                                  className={inputCls(false)}
                                />
                              </Field>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conditional: Pickup capacity */}
                      {watched.bodyType === "pickup" && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Load capacity</p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Payload (kg)">
                              <input
                                {...register("specifications.payloadKg")}
                                type="number"
                                placeholder="1000"
                                className={inputCls(false)}
                              />
                            </Field>
                            <Field label="Towing capacity (kg)">
                              <input
                                {...register("specifications.towingCapacityKg")}
                                type="number"
                                placeholder="3500"
                                className={inputCls(false)}
                              />
                            </Field>
                          </div>
                        </div>
                      )}

                      {/* Interior & exterior */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Interior & exterior</p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Seats">
                            <input
                              {...register("specifications.seats")}
                              type="number"
                              placeholder="5"
                              className={inputCls(false)}
                            />
                          </Field>
                          <Field label="Exterior colour">
                            <input
                              {...register("exteriorColor")}
                              type="text"
                              placeholder="Pearl White"
                              className={inputCls(false)}
                            />
                          </Field>
                          <Field label="Interior colour">
                            <input
                              {...register("interiorColor")}
                              type="text"
                              placeholder="Black leather"
                              className={inputCls(false)}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 mt-4">
                          <Field label="Upholstery">
                            <select
                              {...register("specifications.upholstery")}
                              className={selectCls(false)}
                            >
                              <option value="">Select material</option>
                              <option value="cloth">Cloth</option>
                              <option value="leather">Leather</option>
                              <option value="leatherette">Leatherette</option>
                              <option value="alcantara">Alcantara</option>
                            </select>
                          </Field>
                          <Field label="Previous owners">
                            <input
                              {...register("previousOwners")}
                              type="number"
                              placeholder="1"
                              className={inputCls(false)}
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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

              {/* Footer reassurance */}
              <p className="text-xs text-muted text-center leading-relaxed pt-2">
                Your contact details are only shared with interested buyers
                after you publish your listing.
              </p>
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
                Your listing updates instantly as you type. Add photos to see
                exactly what buyers will see.
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted">
            <CarIcon className="h-10 w-10 opacity-50" />
            <span className="text-xs leading-relaxed">
              Your vehicle preview will appear here as you complete the form.
            </span>
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

// Compact list of decoded facts under the match banner. Only includes
// fields the decoder actually returned, so the line scales 1–7 items
// without ever showing empty placeholders.
function DecodedFactList({ fields }: { fields: DecodedVehicle }) {
  const bits: string[] = [];
  if (fields.bodyType)     bits.push(capitalize(fields.bodyType));
  if (fields.fuel)         bits.push(capitalize(fields.fuel));
  if (fields.transmission) bits.push(fields.transmission === "auto" ? "Auto" : "Manual");
  if (fields.drivetrain)   bits.push(fields.drivetrain.toUpperCase());
  if (fields.engineCc)     bits.push(`${fields.engineCc.toLocaleString()} cc`);
  if (fields.horsepower)   bits.push(`${fields.horsepower} hp`);
  if (bits.length === 0) return null;
  return <p className="text-xs text-muted mt-1 leading-relaxed">{bits.join(" · ")}</p>;
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
  label, error, hint, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-muted/80 leading-relaxed">{hint}</p>
      )}
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

// Human-readable name for form-field paths in the VIN-applied confirmation.
// Falls back to the raw path if we don't have a label yet — better to be
// honest about an unknown key than silently swallow it.
function prettyFieldName(path: string): string {
  const map: Record<string, string> = {
    year: "Year", make: "Make", model: "Model", trim: "Trim",
    bodyType: "Body type", fuel: "Fuel", transmission: "Transmission",
    drivetrain: "Drivetrain",
    "specifications.engineCc":   "Engine cc",
    "specifications.horsepower": "Horsepower",
  };
  return map[path] ?? path;
}

/**
 * Recursively drop `""` and nullish leaves from an object so optional zod
 * fields on the server see `undefined` (and stay optional) instead of `""`
 * (which would fail their string/enum validators). Arrays + non-empty
 * strings + non-zero numbers + booleans are preserved as-is.
 */
function stripEmpty<T>(input: T): T {
  if (Array.isArray(input)) return input;
  if (input === null || typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === "" || v === null || v === undefined) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      const sub = stripEmpty(v) as Record<string, unknown>;
      if (Object.keys(sub).length > 0) out[k] = sub;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
