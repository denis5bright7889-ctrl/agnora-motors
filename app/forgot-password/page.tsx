"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
    } catch { /* swallow */ }
    setSubmitting(false);
    setSent(true);
    // After a short delay, take the user to the reset page with the email pre-filled.
    setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 1500);
  }

  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 font-display text-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">Agnora<span className="text-accent">.</span></span>
          </div>
          <p className="text-sm text-muted">Reset your password</p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
          <h1 className="font-display text-2xl font-medium mb-1">Forgot password</h1>
          <p className="text-sm text-muted mb-7">
            Enter your email and we&apos;ll send a 6-digit code to reset your password.
            Works for Google-only accounts too — you can add a password and use either method afterwards.
          </p>

          {sent ? (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
              If an account exists for <strong className="font-mono">{email}</strong>, we&apos;ve sent a code.
              Redirecting…
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email address
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.co.ke"
                  autoComplete="email"
                  className="w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted border-border focus:border-accent"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send reset code"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-foreground hover:text-accent transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
