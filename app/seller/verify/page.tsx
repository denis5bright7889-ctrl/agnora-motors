"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail, Phone, FileText, CheckCircle2, Clock, XCircle,
  ArrowRight, Upload, Loader2, RefreshCw, ShieldCheck, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerVerification } from "@/lib/db";

// ── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "email",     label: "Email",     icon: Mail },
  { id: "phone",     label: "Phone",     icon: Phone },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "review",    label: "Review",    icon: ShieldCheck },
];

function resolveStep(v: SellerVerification | null, emailVerified: boolean): number {
  if (!emailVerified)       return 0; // block at email
  if (!v?.phoneVerified)    return 1; // need phone OTP
  const allDocs = v.idDocUrl && v.kraCertUrl && v.logbookUrl && v.selfieUrl;
  if (!allDocs)             return 2; // need documents
  if (v.status === "pending") return 3; // ready to submit
  return 4;                            // submitted / approved / rejected
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SellerVerifyPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [verification, setVerification] = useState<SellerVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login?next=/seller/verify");
      return;
    }
    if (sessionStatus !== "authenticated") return;
    fetch("/api/seller/verification")
      .then((r) => r.json())
      .then((d: { verification: SellerVerification }) => setVerification(d.verification))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionStatus, router]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted" />
      </div>
    );
  }

  const emailVerified = Boolean(session?.user?.emailVerified);
  const step = resolveStep(verification, emailVerified);

  // Already approved → go to dashboard
  if (verification?.status === "approved") {
    return <ApprovedScreen />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-2xl mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">Agnora<span className="text-accent">.</span></span>
          </Link>
          <p className="text-sm text-muted">Seller verification</p>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {STEPS.map(({ id, label, icon: Icon }, i) => (
            <div key={id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  i < step  ? "bg-accent text-white" :
                  i === step ? "bg-foreground text-background" :
                               "bg-surface-2 text-muted",
                )}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn(
                  "text-[10px] font-medium hidden sm:block",
                  i === step ? "text-foreground" : "text-muted",
                )}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-px mx-2", i < step ? "bg-accent" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step panels */}
        <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-black/5">
          {step === 0 && <EmailStep />}
          {step === 1 && <PhoneStep onVerified={(v) => setVerification(v)} />}
          {step === 2 && verification && (
            <DocumentsStep
              verification={verification}
              onUpdate={(v) => setVerification(v)}
            />
          )}
          {step === 3 && verification && (
            <SubmitStep
              verification={verification}
              onSubmitted={(v) => setVerification(v)}
            />
          )}
          {step === 4 && verification && <StatusScreen verification={verification} />}
        </div>
      </div>
    </div>
  );
}

// ── Step 0: Email not verified ───────────────────────────────────────────────

function EmailStep() {
  const { data: session } = useSession();
  return (
    <div className="text-center py-2">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mb-4">
        <Mail className="h-7 w-7 text-accent" />
      </div>
      <h2 className="font-display text-xl font-medium mb-2">Verify your email first</h2>
      <p className="text-sm text-muted mb-6">
        Check your inbox for the verification code we sent to{" "}
        <strong className="text-foreground">{session?.user?.email}</strong>.
      </p>
      <Link
        href={`/verify-email?email=${encodeURIComponent(session?.user?.email ?? "")}`}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-accent text-white px-6 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Verify email <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ── Step 1: Phone OTP ────────────────────────────────────────────────────────

function PhoneStep({ onVerified }: { onVerified: (v: SellerVerification) => void }) {
  const [phone,    setPhone]    = useState("");
  const [sent,     setSent]     = useState(false);
  const [digits,   setDigits]   = useState(["", "", "", "", "", ""]);
  const [sending,  setSending]  = useState(false);
  const [checking, setChecking] = useState(false);
  const [error,    setError]    = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  async function sendOtp() {
    setError(""); setSending(true);
    try {
      const res = await fetch("/api/seller/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setError(j.error ?? "Send failed"); return; }
      setSent(true);
    } finally { setSending(false); }
  }

  async function verifyOtp(c: string) {
    setError(""); setChecking(true);
    try {
      const res = await fetch("/api/seller/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, phone }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Verification failed");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
        return;
      }
      const vRes = await fetch("/api/seller/verification");
      const vData = await vRes.json() as { verification: SellerVerification };
      onVerified(vData.verification);
    } finally { setChecking(false); }
  }

  useEffect(() => {
    if (code.length === 6 && !checking) void verifyOtp(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function onDigit(i: number, val: string) {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = v; setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (t.length === 6) setDigits(t.split(""));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
          <Phone className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-lg font-medium leading-tight">Phone verification</h2>
          <p className="text-xs text-muted">We'll send a 6-digit code via SMS</p>
        </div>
      </div>

      {error && <ErrorBanner msg={error} onDismiss={() => setError("")} />}

      {!sent ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Phone number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted"
            />
          </div>
          <button
            onClick={sendOtp}
            disabled={phone.trim().length < 9 || sending}
            className="w-full h-11 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {sending ? "Sending…" : "Send code"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Code sent to <strong className="text-foreground">{phone}</strong>
          </p>
          <div className="flex gap-2 justify-center" onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                value={d} onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                disabled={checking}
                autoFocus={i === 0}
                className={cn(
                  "h-13 w-11 rounded-xl border text-center text-xl font-semibold outline-none transition-colors bg-surface-2",
                  d ? "border-accent" : "border-border",
                  "focus:border-accent",
                )}
                style={{ height: "52px" }}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {checking && (
            <p className="text-center text-sm text-muted flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </p>
          )}
          <button
            onClick={() => { setSent(false); setDigits(["", "", "", "", "", ""]); }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground mx-auto transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Change number / resend
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Documents ────────────────────────────────────────────────────────

interface DocField {
  key: "idDocUrl" | "kraCertUrl" | "logbookUrl" | "selfieUrl" | "businessCertUrl";
  label: string;
  hint: string;
  required: boolean;
}

const DOC_FIELDS: DocField[] = [
  { key: "idDocUrl",        label: "National ID / Passport",          hint: "Front side, clear photo or scan", required: true },
  { key: "kraCertUrl",      label: "KRA PIN Certificate",             hint: "Download from iTax portal",        required: true },
  { key: "logbookUrl",      label: "Vehicle Logbook",                 hint: "Proof of ownership",               required: true },
  { key: "selfieUrl",       label: "Selfie with your ID",             hint: "Hold your ID next to your face",   required: true },
  { key: "businessCertUrl", label: "Business Certificate (optional)", hint: "For businesses only",              required: false },
];

function DocumentsStep({
  verification,
  onUpdate,
}: {
  verification: SellerVerification;
  onUpdate: (v: SellerVerification) => void;
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [error, setError]         = useState("");

  async function upload(file: File, key: DocField["key"]) {
    setError(""); setUploading((u) => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "agnora/seller-docs");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json() as { url?: string; error?: string };
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed");

      const patchRes = await fetch("/api/seller/verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: uploadJson.url }),
      });
      const patchJson = await patchRes.json() as { verification: SellerVerification; error?: string };
      if (!patchRes.ok) throw new Error(patchJson.error ?? "Save failed");
      onUpdate(patchJson.verification);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  }

  const requiredDone = DOC_FIELDS
    .filter((f) => f.required)
    .every((f) => Boolean(verification[f.key]));

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
          <FileText className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-lg font-medium leading-tight">Upload documents</h2>
          <p className="text-xs text-muted">JPG, PNG or PDF · max 5 MB each</p>
        </div>
      </div>

      {error && <ErrorBanner msg={error} onDismiss={() => setError("")} />}

      <div className="space-y-3">
        {DOC_FIELDS.map((f) => (
          <DocRow
            key={f.key}
            field={f}
            url={verification[f.key]}
            loading={uploading[f.key]}
            onFile={(file) => upload(file, f.key)}
          />
        ))}
      </div>

      {requiredDone && (
        <p className="mt-4 text-xs text-center text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All required documents uploaded — continue to review
        </p>
      )}
    </div>
  );
}

function DocRow({
  field, url, loading, onFile,
}: {
  field: DocField;
  url: string | null | undefined;
  loading: boolean | undefined;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-accent ml-0.5">*</span>}
          </p>
          <p className="text-xs text-muted">{field.hint}</p>
        </div>
        <div className="shrink-0">
          {url ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" style={{ height: "18px", width: "18px" }} />
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs text-muted underline hover:text-foreground transition-colors"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {loading ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

// ── Step 3: Submit ───────────────────────────────────────────────────────────

function SubmitStep({
  verification,
  onSubmitted,
}: {
  verification: SellerVerification;
  onSubmitted: (v: SellerVerification) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  async function submit() {
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/seller/verification", { method: "POST" });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setError(j.error ?? "Submit failed"); return; }
      const vRes = await fetch("/api/seller/verification");
      const vData = await vRes.json() as { verification: SellerVerification };
      onSubmitted(vData.verification);
    } finally { setSubmitting(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
          <ShieldCheck className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-lg font-medium leading-tight">Review & submit</h2>
          <p className="text-xs text-muted">Confirm before sending to Agnora</p>
        </div>
      </div>

      {error && <ErrorBanner msg={error} onDismiss={() => setError("")} />}

      <div className="space-y-2 mb-6">
        <CheckRow label="Email verified"         done />
        <CheckRow label="Phone verified"         done={verification.phoneVerified} />
        <CheckRow label="National ID / Passport" done={Boolean(verification.idDocUrl)} />
        <CheckRow label="KRA PIN Certificate"    done={Boolean(verification.kraCertUrl)} />
        <CheckRow label="Vehicle Logbook"        done={Boolean(verification.logbookUrl)} />
        <CheckRow label="Selfie with ID"         done={Boolean(verification.selfieUrl)} />
      </div>

      <p className="text-xs text-muted mb-4 leading-relaxed">
        By submitting you confirm that all uploaded documents are genuine and belong to you.
        Applications are reviewed within <strong className="text-foreground">1–2 business days</strong>.
      </p>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {submitting ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2.5">
      {done
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        : <XCircle      className="h-4 w-4 text-red-400 shrink-0" />}
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ── Step 4: Status screens ───────────────────────────────────────────────────

function StatusScreen({ verification }: { verification: SellerVerification }) {
  if (verification.status === "submitted") {
    return (
      <div className="text-center py-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
          <Clock className="h-8 w-8 text-accent" />
        </div>
        <h2 className="font-display text-xl font-medium mb-2">Application under review</h2>
        <p className="text-sm text-muted leading-relaxed">
          We're verifying your documents. This usually takes{" "}
          <strong className="text-foreground">1–2 business days</strong>.
          You'll receive an email once approved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-surface-2 transition-colors"
        >
          Back to Agnora
        </Link>
      </div>
    );
  }

  if (verification.status === "rejected") {
    return (
      <div className="text-center py-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-4">
          <XCircle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="font-display text-xl font-medium mb-2">Application rejected</h2>
        {verification.adminNotes && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 mb-4 text-left">
            <strong>Reason:</strong> {verification.adminNotes}
          </div>
        )}
        <p className="text-sm text-muted mb-5">
          Please update your documents and resubmit.
        </p>
        <Link
          href="/seller/verify"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent text-white px-6 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Resubmit <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return null;
}

function ApprovedScreen() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="text-center max-w-sm">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-5">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h1 className="font-display text-2xl font-medium mb-2">You're verified!</h1>
        <p className="text-sm text-muted mb-7">
          Your seller account is approved. You can now list cars on Agnora.
        </p>
        <Link
          href="/private-dashboard"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Go to dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
      <X className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} className="shrink-0 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
