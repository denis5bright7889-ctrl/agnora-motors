"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  ExternalLink, Search, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerVerification } from "@/lib/db";

const TABS = ["all", "submitted", "approved", "rejected", "pending"] as const;
type Tab = (typeof TABS)[number];

const STATUS_PILL: Record<string, string> = {
  pending:   "bg-surface-2 text-muted",
  submitted: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  approved:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected:  "bg-red-500/15 text-red-500",
};

export default function AdminSellersPage() {
  const [tab,     setTab]     = useState<Tab>("submitted");
  const [sellers, setSellers] = useState<SellerVerification[]>([]);
  const [counts,  setCounts]  = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sellers?status=${t}`);
      const json = await res.json() as { sellers: SellerVerification[]; counts: Record<string, number> };
      setSellers(json.sellers ?? []);
      setCounts(json.counts  ?? {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  async function review(id: string, status: "approved" | "rejected", adminNotes?: string) {
    await fetch("/api/admin/sellers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminNotes }),
    });
    void load(tab);
  }

  const filtered = sellers.filter((s) =>
    !search || [s.userName, s.userEmail, s.phone].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-medium">Seller verification</h1>
        <p className="text-sm text-muted mt-1">Review KYC applications before sellers can list cars</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 h-8 rounded-full px-3.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:bg-surface hover:text-foreground border border-border",
            )}
          >
            {t}
            {counts[t] != null && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === t ? "bg-white/20" : "bg-surface text-foreground",
              )}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full h-9 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted text-sm">
          No applications found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SellerCard key={s.id} seller={s} onReview={review} />
          ))}
        </div>
      )}
    </div>
  );
}

function SellerCard({
  seller,
  onReview,
}: {
  seller: SellerVerification;
  onReview: (id: string, status: "approved" | "rejected", notes?: string) => void;
}) {
  const [expanded,    setExpanded]    = useState(seller.status === "submitted");
  const [rejectMode,  setRejectMode]  = useState(false);
  const [notes,       setNotes]       = useState("");
  const [acting,      setActing]      = useState(false);

  async function act(status: "approved" | "rejected") {
    setActing(true);
    await onReview(seller.id, status, status === "rejected" ? notes : undefined);
    setActing(false);
    setRejectMode(false);
    setNotes("");
  }

  const docs: { label: string; url: string | null | undefined }[] = [
    { label: "National ID / Passport", url: seller.idDocUrl },
    { label: "KRA PIN Certificate",    url: seller.kraCertUrl },
    { label: "Vehicle Logbook",        url: seller.logbookUrl },
    { label: "Selfie with ID",         url: seller.selfieUrl },
    { label: "Business Certificate",   url: seller.businessCertUrl },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{seller.userName ?? "—"}</p>
          <p className="text-xs text-muted truncate">{seller.userEmail} · {seller.phone ?? "no phone"}</p>
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize",
          STATUS_PILL[seller.status],
        )}>
          {seller.status}
        </span>
        {seller.submittedAt && (
          <span className="hidden sm:block shrink-0 text-xs text-muted">
            {new Date(seller.submittedAt).toLocaleDateString()}
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Verification checklist */}
          <div className="grid grid-cols-2 gap-2">
            <Check label="Email verified"  done />
            <Check label="Phone verified"  done={seller.phoneVerified} />
            {docs.map((d) => d.url && (
              <a
                key={d.label}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs hover:bg-surface-2 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{d.label}</span>
                <ExternalLink className="h-3 w-3 text-muted ml-auto shrink-0" />
              </a>
            ))}
          </div>

          {seller.adminNotes && (
            <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              <strong className="text-foreground">Admin note:</strong> {seller.adminNotes}
            </div>
          )}

          {/* Actions */}
          {seller.status === "submitted" && (
            <div className="space-y-3">
              {rejectMode ? (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for rejection (shown to seller)…"
                    rows={2}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none placeholder:text-muted"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => act("rejected")}
                      disabled={acting || !notes.trim()}
                      className="flex-1 h-10 rounded-full bg-red-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Confirm rejection
                    </button>
                    <button
                      onClick={() => setRejectMode(false)}
                      className="h-10 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => act("approved")}
                    disabled={acting}
                    className="flex-1 h-10 rounded-full bg-emerald-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectMode(true)}
                    className="flex-1 h-10 rounded-full border border-red-500/40 text-red-500 text-sm font-semibold hover:bg-red-500/8 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Check({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2/50 px-3 py-2">
      {done
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        : <Clock        className="h-3.5 w-3.5 text-muted shrink-0" />}
      <span className="text-xs">{label}</span>
    </div>
  );
}
