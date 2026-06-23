"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield, RefreshCw, ChevronLeft, ChevronRight,
  Search, Filter, Clock, Bot, User as UserIcon, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminLog } from "@/lib/db";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  role_change:        { label: "Role change",         color: "bg-blue-500/15 text-blue-400" },
  user_deactivate:    { label: "User deactivated",    color: "bg-red-500/15 text-red-400" },
  user_activate:      { label: "User activated",      color: "bg-green-500/15 text-green-400" },
  user_suspend:       { label: "User suspended",      color: "bg-red-500/15 text-red-400" },
  user_unsuspend:     { label: "User unsuspended",    color: "bg-green-500/15 text-green-400" },
  user_strike:        { label: "User strike",         color: "bg-orange-500/15 text-orange-500" },
  dealer_approve:     { label: "Dealer approved",     color: "bg-green-500/15 text-green-400" },
  dealer_reject:      { label: "Dealer rejected",     color: "bg-red-500/15 text-red-400" },
  dealer_suspend:     { label: "Dealer suspended",    color: "bg-red-500/15 text-red-400" },
  dealer_unsuspend:   { label: "Dealer unsuspended",  color: "bg-green-500/15 text-green-400" },
  dealer_strike:      { label: "Dealer strike",       color: "bg-orange-500/15 text-orange-500" },
  seller_approve:     { label: "Seller approved",     color: "bg-green-500/15 text-green-400" },
  seller_reject:      { label: "Seller rejected",     color: "bg-red-500/15 text-red-400" },
  impersonate_start:  { label: "Impersonation start", color: "bg-amber-500/15 text-amber-400" },
  impersonate_end:    { label: "Impersonation end",   color: "bg-surface-2 text-muted" },
  listing_delete:     { label: "Listing deleted",     color: "bg-red-500/15 text-red-400" },
  listing_feature:    { label: "Listing featured",    color: "bg-accent/15 text-accent" },
  listing_hide:       { label: "Listing hidden",      color: "bg-orange-500/15 text-orange-500" },
  listing_unhide:     { label: "Listing unhidden",    color: "bg-green-500/15 text-green-400" },
  listing_archive:    { label: "Listing archived",    color: "bg-zinc-500/15 text-zinc-400" },
  listing_approve:    { label: "Listing approved",    color: "bg-green-500/15 text-green-400" },
  listing_reject:     { label: "Listing rejected",    color: "bg-red-500/15 text-red-400" },
  listing_mark_sold:  { label: "Listing sold",        color: "bg-surface-2 text-muted" },
  listing_auto_hide:  { label: "Auto-hidden",         color: "bg-orange-500/15 text-orange-500" },
  content_approve:    { label: "Content approved",    color: "bg-green-500/15 text-green-400" },
  content_reject:     { label: "Content rejected",    color: "bg-red-500/15 text-red-400" },
  content_delete:     { label: "Content deleted",     color: "bg-red-500/15 text-red-400" },
};

// PR4 stamps admin_id="system:auto-moderator" on automated hides. Detecting
// it here so the row gets a Bot icon and the source filter can isolate
// human-only or system-only activity.
function isSystemActor(adminId: string): boolean {
  return adminId.startsWith("system:");
}

type SourceFilter = "all" | "human" | "system";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const PAGE_SIZE = 50;

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export default function AdminLogsPage() {
  const [logs, setLogs]         = useState<AdminLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [action, setAction]     = useState("");
  const [source, setSource]     = useState<SourceFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (action) params.set("action", action);

      const res  = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json() as { logs: AdminLog[]; total: number };
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => { void load(); }, [load]);

  const filtered = logs.filter((l) => {
    if (source === "human"  && isSystemActor(l.adminId)) return false;
    if (source === "system" && !isSystemActor(l.adminId)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay =
        l.adminEmail.toLowerCase() + " " +
        l.action.toLowerCase()      + " " +
        l.targetId.toLowerCase()    + " " +
        JSON.stringify(l.details).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium">Activity logs</h1>
            <p className="text-sm text-muted">
              {total.toLocaleString()} total entries
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setPage(0); void load(); }}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by admin, target, or details…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(0); }}
            aria-label="Filter by action type"
            className="h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-8 text-sm outline-none focus:border-accent transition-colors appearance-none min-w-[180px]"
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-8 text-sm outline-none focus:border-accent transition-colors appearance-none min-w-[150px]"
            aria-label="Filter by actor source"
          >
            <option value="all">All actors</option>
            <option value="human">Human only</option>
            <option value="system">System only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-2">
            <Shield className="h-10 w-10 opacity-20" />
            <p className="text-sm">No log entries found</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />Time
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden md:table-cell">Target</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-surface-2 text-muted" };
                const isOpen = expanded === log.id;
                const hasDetails = Object.keys(log.details).length > 0;
                const isSystem = isSystemActor(log.adminId);
                // Logs that PR1 admin/cars + PR4 auto-mod write include slug
                // in details; use it to deep-link straight to the listing.
                const slug = typeof log.details?.slug === "string" ? log.details.slug : null;
                const carTarget = log.targetType === "car" && slug ? `/cars/${slug}` : null;

                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => hasDetails && setExpanded(isOpen ? null : log.id)}
                      className={cn(
                        "border-b border-border last:border-0 transition-colors",
                        hasDetails && "cursor-pointer hover:bg-surface-2/60",
                        isSystem && "bg-surface-2/30",
                      )}
                    >
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {fmtTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {isSystem
                            ? <Bot      className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="System actor" />
                            : <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          }
                          <span className={cn(
                            "font-medium text-xs truncate max-w-[160px]",
                            isSystem && "text-amber-500",
                          )}>
                            {isSystem ? log.adminId.replace(/^system:/, "") : log.adminEmail}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                          meta.color,
                        )}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted text-xs">
                        <span className="capitalize">{log.targetType}</span>
                        {carTarget ? (
                          <Link
                            href={carTarget}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1.5 inline-flex items-center gap-0.5 text-accent hover:underline"
                          >
                            <span className="font-mono text-[10px]">{slug!.slice(0, 20)}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        ) : (
                          <span className="ml-1 font-mono text-[10px] opacity-60">
                            {log.targetId.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted text-xs max-w-xs truncate">
                        {hasDetails ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-b border-border bg-surface-2/40">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-xs font-mono text-muted whitespace-pre-wrap break-all">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                          <p className="text-[10px] text-muted mt-1">
                            Target ID: <span className="font-mono">{log.targetId}</span>
                            {" · "}Admin ID: <span className="font-mono">{log.adminId}</span>
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-muted px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-surface-2 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
