"use client";

import { useState, useRef } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ArrowLeft, Upload, CheckCircle2, Clock, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Step schemas ────────────────────────────────────────────
const step1Schema = z.object({
  name: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Valid phone number required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const step2Schema = z.object({
  businessName: z.string().min(2, "Business name required"),
  businessReg: z.string().min(3, "Registration number required"),
  kraPin: z.string().min(10, "KRA PIN required (e.g. A000000000A)"),
  location: z.string().min(2, "Location required"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

interface Docs {
  directorIdUrl: string;
  businessCertUrl: string;
}

const STEPS = ["Your details", "Business info", "Documents", "Review"];

export default function DealerRegisterPage() {
  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [docs, setDocs] = useState<Partial<Docs>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const idRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  // ── File upload helper ────────────────────────────────────
  async function uploadFile(file: File, key: keyof Docs) {
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "agnora/docs");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDocs((d) => ({ ...d, [key]: json.url }));
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  }

  // ── Submit final application ──────────────────────────────
  async function submit() {
    if (!step1Data || !step2Data || !docs.directorIdUrl || !docs.businessCertUrl) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Register user account (role: "dealer" auto-verifies email so
      //    sign-in succeeds immediately — KYC via documents is stricter anyway)
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1Data.name,
          email: step1Data.email,
          password: step1Data.password,
          role: "dealer",
        }),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) throw new Error(regJson.error ?? "Registration failed");

      // 2. Sign in
      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email: step1Data.email,
        password: step1Data.password,
        redirect: false,
      });
      if (result?.error) throw new Error("Sign in failed after registration");

      // 3. Submit dealer application
      const dealerRes = await fetch("/api/dealer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...step2Data,
          directorName: step1Data.name,
          phone: step1Data.phone,
          directorIdUrl: docs.directorIdUrl,
          businessCertUrl: docs.businessCertUrl,
        }),
      });
      const dealerJson = await dealerRes.json();
      if (!dealerRes.ok) throw new Error(dealerJson.error ?? "Application failed");

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
            <Clock className="h-9 w-9 text-accent" />
          </div>
          <h1 className="font-display text-3xl font-medium mb-3">
            Application submitted!
          </h1>
          <p className="text-muted mb-8 leading-relaxed">
            Your dealer application is under review. We verify all business
            documents within <strong className="text-foreground">1–2 business days</strong>.
            You'll receive an email once approved.
          </p>
          <Link
            href="/dealer/dashboard"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Go to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grain min-h-[calc(100vh-4rem)] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-2xl mb-3"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">
              Agnora<span className="text-accent">.</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-medium">
            Become a verified dealer
          </h1>
          <p className="text-sm text-muted mt-1">
            List your inventory and reach thousands of Kenyan buyers
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  i < step
                    ? "bg-accent text-white"
                    : i === step
                      ? "bg-foreground text-background"
                      : "bg-surface-2 text-muted",
                )}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  i === step ? "text-foreground" : "text-muted",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px",
                    i < step ? "bg-accent" : "bg-border",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
              <X className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Step 1: Personal details ── */}
          {step === 0 && (
            <form
              onSubmit={form1.handleSubmit((data) => {
                setStep1Data(data);
                setStep(1);
              })}
              className="space-y-4"
            >
              <h2 className="font-display text-xl font-medium mb-5">
                Your details
              </h2>
              <Field label="Full name" error={form1.formState.errors.name?.message}>
                <input
                  {...form1.register("name")}
                  placeholder="Jane Mwangi"
                  className={inputCls(!!form1.formState.errors.name)}
                />
              </Field>
              <Field label="Email address" error={form1.formState.errors.email?.message}>
                <input
                  {...form1.register("email")}
                  type="email"
                  placeholder="you@business.co.ke"
                  className={inputCls(!!form1.formState.errors.email)}
                />
              </Field>
              <Field label="Phone number" error={form1.formState.errors.phone?.message}>
                <input
                  {...form1.register("phone")}
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  className={inputCls(!!form1.formState.errors.phone)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password" error={form1.formState.errors.password?.message}>
                  <input
                    {...form1.register("password")}
                    type="password"
                    placeholder="Min 8 chars"
                    className={inputCls(!!form1.formState.errors.password)}
                  />
                </Field>
                <Field label="Confirm password" error={form1.formState.errors.confirmPassword?.message}>
                  <input
                    {...form1.register("confirmPassword")}
                    type="password"
                    placeholder="Repeat password"
                    className={inputCls(!!form1.formState.errors.confirmPassword)}
                  />
                </Field>
              </div>
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* ── Step 2: Business info ── */}
          {step === 1 && (
            <form
              onSubmit={form2.handleSubmit((data) => {
                setStep2Data(data);
                setStep(2);
              })}
              className="space-y-4"
            >
              <h2 className="font-display text-xl font-medium mb-5">
                Business information
              </h2>
              <Field label="Business / dealership name" error={form2.formState.errors.businessName?.message}>
                <input
                  {...form2.register("businessName")}
                  placeholder="Prestige Auto Kenya Ltd"
                  className={inputCls(!!form2.formState.errors.businessName)}
                />
              </Field>
              <Field label="Business registration number" error={form2.formState.errors.businessReg?.message}>
                <input
                  {...form2.register("businessReg")}
                  placeholder="PVT-XXXXXX"
                  className={inputCls(!!form2.formState.errors.businessReg)}
                />
              </Field>
              <Field label="KRA PIN" error={form2.formState.errors.kraPin?.message}>
                <input
                  {...form2.register("kraPin")}
                  placeholder="A000000000A"
                  className={inputCls(!!form2.formState.errors.kraPin)}
                />
              </Field>
              <Field label="Business location" error={form2.formState.errors.location?.message}>
                <select
                  {...form2.register("location")}
                  className={inputCls(!!form2.formState.errors.location)}
                >
                  <option value="">Select city</option>
                  {["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="h-12 rounded-full border border-border px-5 text-sm font-medium hover:bg-surface-2 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Document uploads ── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-medium mb-1">
                Upload documents
              </h2>
              <p className="text-sm text-muted mb-5">
                Required to verify your dealership. Accepted: JPG, PNG, PDF.
                Max 5 MB per file.
              </p>

              <DocUpload
                label="Director / Owner National ID (front)"
                hint="Clear photo or scan of your national ID"
                url={docs.directorIdUrl}
                loading={uploading["directorIdUrl"]}
                inputRef={idRef}
                onFileChange={(f) => uploadFile(f, "directorIdUrl")}
              />

              <DocUpload
                label="Certificate of Business Registration"
                hint="Official certificate from Registrar of Companies"
                url={docs.businessCertUrl}
                loading={uploading["businessCertUrl"]}
                inputRef={certRef}
                onFileChange={(f) => uploadFile(f, "businessCertUrl")}
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-12 rounded-full border border-border px-5 text-sm font-medium hover:bg-surface-2 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  disabled={!docs.directorIdUrl || !docs.businessCertUrl}
                  onClick={() => setStep(3)}
                  className="flex-1 h-12 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  Review application <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Submit ── */}
          {step === 3 && step1Data && step2Data && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-medium mb-1">
                Review & submit
              </h2>
              <p className="text-sm text-muted mb-4">
                Confirm your details before submitting.
              </p>

              <ReviewSection title="Personal details">
                <ReviewRow label="Name" value={step1Data.name} />
                <ReviewRow label="Email" value={step1Data.email} />
                <ReviewRow label="Phone" value={step1Data.phone} />
              </ReviewSection>

              <ReviewSection title="Business details">
                <ReviewRow label="Business name" value={step2Data.businessName} />
                <ReviewRow label="Reg. number" value={step2Data.businessReg} />
                <ReviewRow label="KRA PIN" value={step2Data.kraPin} />
                <ReviewRow label="Location" value={step2Data.location} />
              </ReviewSection>

              <ReviewSection title="Documents">
                <ReviewRow label="Director ID" value="Uploaded ✓" />
                <ReviewRow label="Business cert." value="Uploaded ✓" />
              </ReviewSection>

              <p className="text-xs text-muted">
                By submitting you agree to Agnora's{" "}
                <Link href="#" className="underline">dealer terms</Link>.
                Applications are reviewed within 1–2 business days.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="h-12 rounded-full border border-border px-5 text-sm font-medium hover:bg-surface-2 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="flex-1 h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit application <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:text-accent transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function DocUpload({
  label, hint, url, loading, inputRef, onFileChange,
}: {
  label: string;
  hint: string;
  url?: string;
  loading?: boolean;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileChange: (f: File) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</p>
      <p className="text-xs text-muted mb-3">{hint}</p>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChange(f);
        }}
      />
      {url ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <span className="text-sm text-green-600 dark:text-green-400 truncate">
            Document uploaded
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ml-auto text-xs text-muted hover:text-foreground underline"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full rounded-xl border-2 border-dashed border-border py-6 text-sm flex flex-col items-center gap-2 hover:border-accent hover:bg-accent-soft/30 transition-all",
            loading && "opacity-60",
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          ) : (
            <Upload className="h-5 w-5 text-muted" />
          )}
          <span className="text-muted">
            {loading ? "Uploading…" : "Click to upload"}
          </span>
        </button>
      )}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted",
    hasError ? "border-red-500" : "border-border focus:border-accent",
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
