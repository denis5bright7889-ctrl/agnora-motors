"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, X } from "lucide-react";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState(searchParams.get("email") ?? "");
  const [code, setCode]         = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone]         = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(body.error ?? "Reset failed");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login?verified=1"), 1500);
    } catch {
      setServerError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
        Password updated. Redirecting to sign in…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {serverError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
          <X className="h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}

      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none border-border focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">6-digit code</span>
        <input
          type="text"
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none border-border focus:border-accent tracking-widest text-center"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">New password</span>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Min 8 characters"
            className="w-full h-11 rounded-xl border bg-surface-2 px-4 pr-11 text-sm outline-none border-border focus:border-accent placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={submitting || !email || !code || !password}
        className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 font-display text-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">Agnora<span className="text-accent">.</span></span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
          <h1 className="font-display text-2xl font-medium mb-1">Reset password</h1>
          <p className="text-sm text-muted mb-7">Enter the code we sent to your email and choose a new password.</p>

          <Suspense fallback={<div className="h-32" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Need a fresh code?{" "}
          <Link href="/forgot-password" className="font-medium text-foreground hover:text-accent transition-colors">
            Resend
          </Link>
        </p>
      </div>
    </div>
  );
}
