"use client";

import { useMemo } from "react";
import {
  DollarSign, Users, Car, TrendingUp, Clock,
  Wifi, WifiOff, RefreshCw, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { useLiveAnalytics, type LiveSnapshot } from "@/hooks/use-live-analytics";

// ── Status badge ──────────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: "connecting" | "live" | "reconnecting" | "error" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
      state === "live"         && "bg-green-500/15 text-green-500",
      state === "connecting"   && "bg-surface-2 text-muted",
      state === "reconnecting" && "bg-amber-500/15 text-amber-500",
      state === "error"        && "bg-red-500/15 text-red-500",
    )}>
      {state === "live"         && <Wifi        className="h-3 w-3" />}
      {state === "reconnecting" && <RefreshCw   className="h-3 w-3 animate-spin" />}
      {(state === "connecting" || state === "error") && <WifiOff className="h-3 w-3" />}
      {state === "live"         ? "Live"         : null}
      {state === "connecting"   ? "Connecting…"  : null}
      {state === "reconnecting" ? "Reconnecting…": null}
      {state === "error"        ? "Offline"      : null}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent, loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border border-border bg-surface p-5 transition-all duration-300",
      loading && "opacity-60",
    )}>
      <div className={cn(
        "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl",
        accent ? "bg-accent/15" : "bg-surface-2",
      )}>
        <Icon className={cn("h-5 w-5", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className={cn(
        "font-display text-2xl font-semibold tabular-nums transition-all duration-500",
        loading && "blur-[2px]",
      )}>
        {value}
      </p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Status donut (CSS-based, live) ────────────────────────────────────────────

const STATUS_COLORS: Record<string, { hex: string; tw: string; label: string }> = {
  active: { hex: "#22c55e", tw: "bg-green-500",  label: "Active" },
  draft:  { hex: "#f59e0b", tw: "bg-amber-500",  label: "Draft"  },
  sold:   { hex: "#3b82f6", tw: "bg-blue-500",   label: "Sold"   },
};

function LiveDonut({ breakdown }: { breakdown: Array<{ status: string; count: number }> }) {
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  const R = 38;
  const CIRC = 2 * Math.PI * R;

  const arcs = useMemo(() => {
    let cumulative = 0;
    return breakdown.map((seg) => {
      const len    = total > 0 ? (seg.count / total) * CIRC : 0;
      const offset = -cumulative;
      cumulative  += len;
      return { ...seg, len, offset };
    });
  }, [breakdown, total, CIRC]);

  if (total === 0) {
    return <p className="text-xs text-muted text-center py-4">No listings yet</p>;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
        <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor"
          strokeOpacity="0.08" strokeWidth="18" />
        <g transform="rotate(-90 60 60)">
          {arcs.map((arc) => (
            <circle
              key={arc.status}
              cx="60" cy="60" r={R}
              fill="none"
              stroke={STATUS_COLORS[arc.status]?.hex ?? "#94a3b8"}
              strokeWidth="18"
              strokeDasharray={`${arc.len.toFixed(2)} ${CIRC.toFixed(2)}`}
              strokeDashoffset={arc.offset.toFixed(2)}
            />
          ))}
        </g>
        <text x="60" y="55" textAnchor="middle" fontSize="16" fontWeight="700"
          fill="currentColor" className="transition-all duration-500">
          {total}
        </text>
        <text x="60" y="70" textAnchor="middle" fontSize="7"
          fill="currentColor" opacity="0.5">listings</text>
      </svg>

      <div className="space-y-2 w-full">
        {breakdown.map((seg) => {
          const meta = STATUS_COLORS[seg.status] ?? { hex: "#94a3b8", tw: "bg-slate-400", label: seg.status };
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
          return (
            <div key={seg.status} className="flex items-center gap-2 text-sm">
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", meta.tw)} />
              <span className="text-muted capitalize">{meta.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden mx-1">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: meta.hex }}
                />
              </div>
              <span className="font-semibold tabular-nums w-8 text-right">{seg.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Event feed ────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  user_registered: "New user registered",
  listing_created: "New listing created",
  listing_sold:    "Listing marked sold",
  dealer_approved: "Dealer approved",
  dealer_rejected: "Dealer rejected",
  seller_approved: "Seller verified",
};

function EventFeed({ events }: { events: Array<{ id: number; type: string; payload: Record<string, unknown>; createdAt: string }> }) {
  if (events.length === 0) {
    return <p className="text-xs text-muted text-center py-6">Waiting for activity…</p>;
  }
  return (
    <ul className="space-y-2">
      {events.slice(0, 8).map((ev) => (
        <li key={ev.id} className="flex items-start gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <Bell className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground leading-tight">
              {EVENT_LABELS[ev.type] ?? ev.type}
            </p>
            {ev.payload.email && (
              <p className="text-muted truncate">{ev.payload.email as string}</p>
            )}
          </div>
          <span className="text-muted whitespace-nowrap">
            {new Date(ev.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Dealer leaderboard ────────────────────────────────────────────────────────

function DealerLeaderboard({ dealers }: { dealers: LiveSnapshot["topDealers"] }) {
  if (dealers.length === 0) return <p className="text-xs text-muted px-4 py-4">No approved dealers yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-surface-2">
          {["#", "Dealer", "Total", "Active", "Sold", "Revenue"].map((h) => (
            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dealers.map((d, i) => (
          <tr key={d.dealerId} className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
            <td className="px-4 py-2.5 text-muted/50 font-display">{i + 1}</td>
            <td className="px-4 py-2.5 font-medium">{d.businessName}</td>
            <td className="px-4 py-2.5 tabular-nums">{d.totalListings}</td>
            <td className="px-4 py-2.5 tabular-nums text-green-500">{d.activeListings}</td>
            <td className="px-4 py-2.5 tabular-nums text-blue-400">{d.soldListings}</td>
            <td className="px-4 py-2.5 tabular-nums font-medium text-accent text-xs">
              {d.revenue > 0 ? `KSh ${formatPrice(d.revenue)}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main live dashboard ───────────────────────────────────────────────────────

interface Props {
  initial: LiveSnapshot;
}

export function LiveDashboard({ initial }: Props) {
  const { snapshot, connState, lastUpdated, recentEvents } = useLiveAnalytics(initial);

  // Fall back to initial data if no snapshot received yet
  const data = snapshot ?? initial;
  const { stats, totalRevenue, statusBreakdown, topDealers } = data;
  const isLoading = !snapshot;

  return (
    <div className="space-y-8">

      {/* ── Live status bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ConnectionBadge state={connState} />
          {lastUpdated && (
            <span className="text-xs text-muted">
              Updated {lastUpdated.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        {connState === "live" && (
          <span className="text-[10px] text-muted hidden sm:block">
            Refreshes every ~1.5 s · auto-reconnects every 45 s
          </span>
        )}
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          label="Total revenue"
          value={`KSh ${formatPrice(totalRevenue)}`}
          sub="From sold listings"
          accent
          loading={isLoading}
        />
        <KpiCard icon={Car}   label="Total listings" value={stats.totalCars.toLocaleString()}    loading={isLoading} />
        <KpiCard icon={Users} label="Total users"    value={stats.totalUsers.toLocaleString()}    loading={isLoading} />
        <KpiCard icon={TrendingUp} label="Active dealers" value={stats.totalDealers.toLocaleString()} loading={isLoading} />
        <KpiCard
          icon={Clock}
          label="Pending approvals"
          value={stats.pendingDealers.toLocaleString()}
          sub="Dealer applications"
          loading={isLoading}
        />
      </div>

      {/* ── Status donut + event feed ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-sm mb-5">Listings by status</h2>
          <LiveDonut breakdown={statusBreakdown} />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-sm">Live activity feed</h2>
            {recentEvents.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            )}
          </div>
          <EventFeed events={recentEvents} />
        </div>
      </div>

      {/* ── Dealer leaderboard (live) ── */}
      {topDealers.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <TrendingUp className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">Top dealers — live</h2>
          </div>
          <DealerLeaderboard dealers={topDealers} />
        </div>
      )}
    </div>
  );
}
