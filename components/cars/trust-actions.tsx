"use client";

import { useState } from "react";
import { Star, Flag, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY_LABELS } from "@/lib/trust";

// Buyer-facing trust entry points on a listing: leave a dealer review, or
// report the listing. Both feed the dealer's Trust dashboard + reputation.
export function TrustActions({ carId, hasDealer }: { carId: string; hasDealer: boolean }) {
  const [modal, setModal] = useState<"review" | "report" | null>(null);
  return (
    <>
      <div className="mt-4 flex items-center justify-center gap-4 text-xs">
        {hasDealer && (
          <button type="button" onClick={() => setModal("review")} className="flex items-center gap-1 text-muted hover:text-accent transition-colors">
            <Star className="h-3.5 w-3.5" /> Rate dealer
          </button>
        )}
        <button type="button" onClick={() => setModal("report")} className="flex items-center gap-1 text-muted hover:text-red-500 transition-colors">
          <Flag className="h-3.5 w-3.5" /> Report listing
        </button>
      </div>
      {modal === "review" && <ReviewModal carId={carId} onClose={() => setModal(null)} />}
      {modal === "report" && <ReportModal carId={carId} onClose={() => setModal(null)} />}
    </>
  );
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-xl font-medium mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Sent({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center">
        <Check className="h-7 w-7 text-green-500" />
      </div>
      <p className="text-sm text-muted">{msg}</p>
      <button type="button" onClick={onClose} className="mt-6 h-11 w-full rounded-full bg-accent text-white text-sm font-semibold">Close</button>
    </div>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star className={cn("h-7 w-7 transition-colors", n <= value ? "fill-yellow-400 text-yellow-400" : "text-border")} />
        </button>
      ))}
    </div>
  );
}

function SubRating({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${label} ${n}`}>
            <Star className={cn("h-4 w-4", n <= value ? "fill-yellow-400 text-yellow-400" : "text-border")} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewModal({ carId, onClose }: { carId: string; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [vehicleAccuracy, setVehicleAccuracy] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [body, setBody] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) { setError("Please give an overall rating."); return; }
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId, name, rating,
          communication: communication || undefined,
          vehicleAccuracy: vehicleAccuracy || undefined,
          professionalism: professionalism || undefined,
          wouldRecommend: recommend ?? undefined,
          body: body || undefined,
        }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Could not submit review."); return; }
      setSent(true);
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  if (sent) return <Shell title="Review submitted" onClose={onClose}><Sent msg="Thanks — your review helps other buyers." onClose={onClose} /></Shell>;

  return (
    <Shell title="Rate this dealer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Overall experience</p>
          <Stars value={rating} onChange={setRating} />
        </div>
        <div className="space-y-2 rounded-xl bg-surface-2 p-3">
          <SubRating label="Communication" value={communication} onChange={setCommunication} />
          <SubRating label="Vehicle accuracy" value={vehicleAccuracy} onChange={setVehicleAccuracy} />
          <SubRating label="Professionalism" value={professionalism} onChange={setProfessionalism} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Would you recommend?</p>
          <div className="flex gap-2">
            {[["Yes", true], ["No", false]].map(([label, val]) => (
              <button key={label as string} type="button" onClick={() => setRecommend(val as boolean)}
                className={cn("h-9 px-4 rounded-full border text-sm font-medium transition-colors",
                  recommend === val ? "border-accent bg-accent text-white" : "border-border hover:border-accent/50")}>
                {label as string}
              </button>
            ))}
          </div>
        </div>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Share details of your experience (optional)"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent resize-none" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit review
        </button>
      </form>
    </Shell>
  );
}

function ReportModal({ carId, onClose }: { carId: string; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) { setError("Please choose a category."); return; }
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, category, detail, email: email || undefined }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Could not submit report."); return; }
      setSent(true);
    } catch { setError("Network error. Please try again."); }
    finally { setBusy(false); }
  }

  if (sent) return <Shell title="Report received" onClose={onClose}><Sent msg="Thanks — our team reviews every report. The dealer is notified to respond." onClose={onClose} /></Shell>;

  return (
    <Shell title="Report this listing" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">What's wrong?</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent cursor-pointer">
            <option value="">Select a reason</option>
            {COMPLAINT_CATEGORIES.map((c) => <option key={c} value={c}>{COMPLAINT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <textarea required value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} placeholder="Describe the issue…"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent resize-none" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email (optional, for follow-up)"
          className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit report
        </button>
      </form>
    </Shell>
  );
}
