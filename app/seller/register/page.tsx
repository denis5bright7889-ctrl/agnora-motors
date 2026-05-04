"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, MapPin, Phone, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PrivateSellerRegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone.trim() || !location.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/seller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, location }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Registration failed"); return; }
      router.push("/dealer/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 font-display text-2xl mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-medium">Agnora<span className="text-accent">.</span></span>
          </div>
          <p className="text-sm text-muted">Private seller registration</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Car,         label: "1 free listing" },
            { icon: CheckCircle2, label: "Free to start" },
            { icon: ArrowRight,   label: "Live in 2 min" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-3 text-center">
              <Icon className="h-5 w-5 text-accent mx-auto mb-1.5" />
              <p className="text-xs font-medium">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-black/5">
          <h1 className="font-display text-2xl font-medium mb-1">List your car</h1>
          <p className="text-sm text-muted mb-6">
            No business registration needed. Your first listing is always free.
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className={cn(inputCls, "pl-9")}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Your location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Westlands, Nairobi"
                  className={cn(inputCls, "pl-9")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Setting up your account…" : (
                <><span>Continue</span><ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted">
            Need to list multiple cars?{" "}
            <Link href="/dealer/register" className="font-medium text-foreground hover:text-accent transition-colors">
              Register as a dealer
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:text-accent">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
