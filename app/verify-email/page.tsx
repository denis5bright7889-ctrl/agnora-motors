"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const emailFailed = searchParams.get("emailError") === "1";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [success, setSuccess] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const SLOT_IDS = ["otp-0", "otp-1", "otp-2", "otp-3", "otp-4", "otp-5"] as const;

  const code = digits.join("");

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !loading && !success) {
      void handleVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleVerify(c: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: c }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Invalid code. Please try again.");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login?verified=1"), 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        setResent(true);
      } else {
        setError(json.error ?? "Failed to resend code. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  function onDigitChange(i: number, value: string) {
    const v = value.replaceAll(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replaceAll(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(""));
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="font-display text-xl font-medium mb-2">Email verified!</h2>
        <p className="text-sm text-muted">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
      <h1 className="font-display text-2xl font-medium mb-1">Check your inbox</h1>
      <p className="text-sm text-muted mb-2">
        We sent a 6-digit code to
      </p>
      <p className="text-sm font-semibold mb-7 truncate">{email || "your email"}</p>

      {emailFailed && !resent && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <RefreshCw className="h-4 w-4 shrink-0" />
          We couldn&apos;t send the code. Tap <strong className="mx-1">Resend code</strong> below to try again.
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {resent && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          New code sent — check your inbox.
        </div>
      )}

      {/* Digit inputs */}
      <div className="flex gap-2 justify-center mb-6" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={SLOT_IDS[i]}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            onChange={(e) => onDigitChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className={cn(
              "h-14 w-12 rounded-xl border text-center text-2xl font-semibold outline-none transition-colors bg-surface-2",
              d ? "border-accent text-foreground" : "border-border text-muted",
              "focus:border-accent",
            )}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
            disabled={loading}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => handleVerify(code)}
        disabled={code.length < 6 || loading}
        className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 mb-4"
      >
        {loading ? "Verifying…" : "Verify email"}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", resending && "animate-spin")} />
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 font-display text-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">
              Agnora<span className="text-accent">.</span>
            </span>
          </div>
          <p className="text-sm text-muted">Kenya's verified car marketplace</p>
        </div>

        <Suspense fallback={<div className="rounded-3xl border border-border bg-surface p-8 h-80 animate-pulse" />}>
          <VerifyEmailForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-muted">
          Wrong email?{" "}
          <Link href="/register" className="font-medium text-foreground hover:text-accent transition-colors">
            Register again
          </Link>
        </p>
      </div>
    </div>
  );
}
