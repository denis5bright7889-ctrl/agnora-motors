"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, Eye, Clock,
  ChevronDown, ChevronUp, ExternalLink, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dealer } from "@/types";

type Status = "all" | "pending" | "approved" | "rejected";

export default function AdminDealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`/api/admin/dealers${status !== "all" ? `?status=${status}` : ""}`)
      .then((r) => r.json())
      .then((j) => setDealers(j.dealers ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  async function approve(id: string) {
    setProcessing(id);
    await fetch("/api/admin/dealers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "approved" }),
    });
    setDealers((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "approved" } : d)),
    );
    setProcessing(null);
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setProcessing(id);
    await fetch("/api/admin/dealers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "rejected", rejectionReason: rejectReason }),
    });
    setDealers((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: "rejected", rejectionReason: rejectReason }
          : d,
      ),
    );
    setProcessing(null);
    setRejectTarget(null);
    setRejectReason("");
  }

  const filtered = dealers.filter((d) => {
    if (query) {
      const q = query.toLowerCase();
      return (
        d.businessName.toLowerCase().includes(q) ||
        (d.userEmail ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: dealers.length,
    pending: dealers.filter((d) => d.status === "pending").length,
    approved: dealers.filter((d) => d.status === "approved").length,
    rejected: dealers.filter((d) => d.status === "rejected").length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="font-display text-3xl font-medium">Dealer applications</h1>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by business name or email…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 shrink-0">
          {(["all", "pending", "approved", "rejected"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setLoading(true); }}
              className={cn(
                "h-8 px-4 rounded-xl text-xs font-semibold capitalize transition-all",
                status === s
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted">
          No dealer applications found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((dealer) => (
            <div key={dealer.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{dealer.businessName}</p>
                    <StatusPill status={dealer.status} />
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {dealer.userEmail} · {dealer.location} ·{" "}
                    {new Date(dealer.createdAt).toLocaleDateString("en-KE")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dealer.status === "pending" && (
                    <>
                      <button
                        disabled={processing === dealer.id}
                        onClick={() => approve(dealer.id)}
                        className="h-8 inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processing === dealer.id ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => setRejectTarget(dealer.id)}
                        className="h-8 inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 text-xs font-semibold text-red-500 hover:bg-red-500/25 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      setExpanded((e) => (e === dealer.id ? null : dealer.id))
                    }
                    className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:bg-surface-2 transition-colors"
                  >
                    {expanded === dealer.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Rejection input */}
              {rejectTarget === dealer.id && (
                <div className="border-t border-border px-5 py-4 bg-red-500/5">
                  <p className="text-sm font-medium mb-2 text-red-500">
                    Reason for rejection (sent to dealer)
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Business registration documents are unreadable. Please resubmit clear scans."
                    className="w-full rounded-xl border border-red-500/30 bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-red-500 resize-none placeholder:text-muted"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={!rejectReason.trim() || processing === dealer.id}
                      onClick={() => reject(dealer.id)}
                      className="h-8 rounded-full bg-red-500 text-white px-4 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {processing === dealer.id ? "Rejecting…" : "Confirm rejection"}
                    </button>
                    <button
                      onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                      className="h-8 rounded-full border border-border px-4 text-xs font-medium hover:bg-surface-2 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Rejection reason display */}
              {dealer.status === "rejected" && dealer.rejectionReason && (
                <div className="border-t border-border px-5 py-3 bg-surface-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Rejection reason
                  </p>
                  <p className="text-sm">{dealer.rejectionReason}</p>
                </div>
              )}

              {/* Expanded details */}
              {expanded === dealer.id && (
                <div className="border-t border-border px-5 py-5 bg-surface-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailGrid title="Business details">
                      <DetailRow label="Business name" value={dealer.businessName} />
                      <DetailRow label="Reg. number" value={dealer.businessReg} />
                      <DetailRow label="KRA PIN" value={dealer.kraPin} />
                      <DetailRow label="Location" value={dealer.location} />
                      <DetailRow label="Phone" value={dealer.phone} />
                    </DetailGrid>
                    <DetailGrid title="Director details">
                      <DetailRow label="Name" value={dealer.directorName} />
                      <DetailRow label="Email" value={dealer.userEmail ?? "—"} />
                    </DetailGrid>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={dealer.directorIdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-9 rounded-xl border border-border px-4 text-xs font-medium hover:bg-surface transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Director ID
                      <ExternalLink className="h-3 w-3 text-muted" />
                    </a>
                    <a
                      href={dealer.businessCertUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-9 rounded-xl border border-border px-4 text-xs font-medium hover:bg-surface transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Business Cert.
                      <ExternalLink className="h-3 w-3 text-muted" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: Clock },
    approved: { label: "Approved", cls: "bg-green-500/15 text-green-600 dark:text-green-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-500", icon: XCircle },
  };
  const { label, cls, icon: Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

function DetailGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}
