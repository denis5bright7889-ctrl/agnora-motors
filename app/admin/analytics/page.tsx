import {
  Car, BarChart3, Activity,
} from "lucide-react";
import {
  getAdminStats, getTotalRevenue,
  getRevenueByMonth, getUserGrowthByMonth,
  getListingStatusBreakdown, getTopDealersByActivity,
  getAdminListingsTable, getDailyViews,
  getAnalyticsEventTotals, getTopSearchTerms,
  getNonCompliantListings, getListingComplianceStats,
  isDbConfigured,
} from "@/lib/db";
import { QUALITY_POLICY_CUTOFF } from "@/lib/quality-policy";
import { AlertTriangle, ImageOff, FileWarning, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { ListingsTable } from "./listings-table";
import { LiveDashboard } from "./live-dashboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill in months that have no data with zero so charts always show N points. */
function fillMonths<T extends { month: string }>(
  data: T[],
  n: number,
  zero: Omit<T, "month">,
): (T & { label: string })[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months.map((m) => {
    const found = data.find((r) => r.month === m);
    const [yr, mo] = m.split("-");
    const label = new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleDateString("en-KE", { month: "short" });
    return { ...(found ?? { month: m, ...zero }), label } as T & { label: string };
  });
}

// ── SVG chart components (server-side, zero JS) ───────────────────────────────

function LineChart({
  points,
  color = "#FF4D2E",
}: {
  points: { label: string; value: number }[];
  color?: string;
}) {
  if (points.length === 0) return <EmptyChart />;
  const W = 440; const H = 120;
  const PL = 4; const PR = 4; const PT = 8; const PB = 22;
  const IW = W - PL - PR;
  const IH = H - PT - PB;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: PL + (points.length > 1 ? (i / (points.length - 1)) * IW : IW / 2),
    y: PT + IH - ((p.value - min) / range) * IH,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PT + IH).toFixed(1)} L ${PL} ${(PT + IH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lg)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill={color} />
      ))}
      {points.map((p, i) => (
        <text key={p.label} x={coords[i].x} y={H - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.45">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function BarChart({ points, color = "#FF4D2E" }: { points: { label: string; value: number }[]; color?: string }) {
  if (points.length === 0) return <EmptyChart />;
  const W = 440; const H = 120;
  const PL = 4; const PR = 4; const PT = 8; const PB = 22;
  const IW = W - PL - PR;
  const IH = H - PT - PB;
  const max = Math.max(...points.map((p) => p.value), 1);
  const barW = Math.max(4, IW / points.length - 4);
  const gap  = (IW - barW * points.length) / (points.length + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {points.map((p, i) => {
        const barH = (p.value / max) * IH;
        const x = PL + gap + i * (barW + gap);
        const y = PT + IH - barH;
        return (
          <g key={p.label}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx="3" fill={color} fillOpacity={p.value > 0 ? 0.8 : 0.2} />
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.45">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart label="No listings" />;
  const R = 38; const CIRC = 2 * Math.PI * R;
  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * CIRC;
    const arc = { ...seg, dasharray: `${len.toFixed(2)} ${CIRC.toFixed(2)}`, offset: (-cumulative).toFixed(2) };
    cumulative += len;
    return arc;
  });

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[140px] mx-auto">
      <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="18" />
      <g transform="rotate(-90 60 60)">
        {arcs.map((arc) => (
          <circle key={arc.label} cx="60" cy="60" r={R} fill="none"
            stroke={arc.color} strokeWidth="18"
            strokeDasharray={arc.dasharray} strokeDashoffset={arc.offset}
          />
        ))}
      </g>
      <text x="60" y="56" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">{total}</text>
      <text x="60" y="70" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.5">listings</text>
    </svg>
  );
}

function EmptyChart({ label = "No data yet" }: { label?: string }) {
  return (
    <div className="h-[120px] flex items-center justify-center text-xs text-muted opacity-60">
      {label}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-accent/15" : "bg-surface-2"}`}>
        <Icon className={`h-5 w-5 ${accent ? "text-accent" : "text-muted"}`} />
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Legend chip ───────────────────────────────────────────────────────────────

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-muted capitalize">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage() {
  const dbUp = isDbConfigured();
  const N = 6; // months

  const [
    stats, totalRevenue, revenueRaw, growthRaw,
    statusBreakdown, topDealers, dailyViews, listings,
    eventTotals, topSearches, nonCompliant, complianceStats,
  ] = await Promise.all([
    dbUp ? getAdminStats()                  : Promise.resolve({ totalCars: 0, totalDealers: 0, totalUsers: 0, pendingDealers: 0, totalSearches: 0, totalContacts: 0 }),
    dbUp ? getTotalRevenue()                : Promise.resolve(0),
    dbUp ? getRevenueByMonth(N)             : Promise.resolve([]),
    dbUp ? getUserGrowthByMonth(N)          : Promise.resolve([]),
    dbUp ? getListingStatusBreakdown()      : Promise.resolve([]),
    dbUp ? getTopDealersByActivity(10)      : Promise.resolve([]),
    dbUp ? getDailyViews(30)               : Promise.resolve([]),
    dbUp ? getAdminListingsTable({ limit: 200 }) : Promise.resolve([]),
    dbUp ? getAnalyticsEventTotals(7, 12)   : Promise.resolve([]),
    dbUp ? getTopSearchTerms(7, 10)         : Promise.resolve([]),
    dbUp ? getNonCompliantListings(50)      : Promise.resolve([]),
    dbUp ? getListingComplianceStats()      : Promise.resolve({ grandfathered: 0, compliant: 0, hidden: 0 }),
  ]);

  // PR8: derive conversion rate from PR3b/PR8 events.
  const searchSubmissions = eventTotals.find((e) => e.name === "search_submitted")?.total ?? 0;
  const listingViews      = eventTotals.find((e) => e.name === "listing_viewed")?.total   ?? 0;
  const contactRequests   = eventTotals.find((e) => e.name === "contact_request_created")?.total ?? 0;
  const viewToContactPct  = listingViews > 0 ? ((contactRequests / listingViews) * 100).toFixed(1) : "0.0";
  const searchToViewPct   = searchSubmissions > 0 ? ((listingViews / searchSubmissions) * 100).toFixed(1) : "0.0";

  // Fill sparse month arrays so every chart shows N bars/points
  const revenueByMonth = fillMonths(revenueRaw,    N, { revenue: 0 } as { revenue: number });
  const userGrowth     = fillMonths(growthRaw,     N, { count: 0 }   as { count: number });

  // Status donut data
  const STATUS_COLORS: Record<string, string> = {
    active: "#22c55e",
    draft:  "#f59e0b",
    sold:   "#3b82f6",
  };
  const donutSegments = statusBreakdown.map((s) => ({
    label: s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#94a3b8",
  }));

  // Views sparkline for 30-day activity
  const maxViews = Math.max(...dailyViews.map((d) => Number(d.views)), 1);

  // Build initial snapshot for the LiveDashboard client component so the
  // page does not flash empty KPIs while the first SSE message arrives.
  const initialSnapshot = {
    timestamp:       new Date().toISOString(),
    stats,
    totalRevenue,
    statusBreakdown,
    topDealers:      topDealers.slice(0, 5),
  };

  return (
    <div className="space-y-10 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Analytics</h1>
          <p className="text-sm text-muted mt-1">
            {dbUp ? "Real-time · KPIs and status update automatically" : "⚠ No database — connect one for live analytics"}
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted">
          <Activity className="h-3 w-3" />
          {dbUp ? "SSE stream" : "DB offline"}
        </span>
      </div>

      {/* ── Live section (KPIs + status donut + event feed + dealer table) ──
          Server renders initial data; client subscribes to SSE and updates. */}
      <LiveDashboard initial={initialSnapshot} />

      {/* ── PR8: Search & engagement funnel (last 7 days) ── */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-sm">Search & engagement funnel</h2>
          <span className="text-[10px] uppercase tracking-widest text-muted">Last 7 days</span>
        </div>
        <p className="text-xs text-muted mb-4">Client-fired events from /api/analytics/event. Funnel works without identifying users.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Search submissions", value: searchSubmissions },
            { label: "Listing views",      value: listingViews },
            { label: "Contact requests",   value: contactRequests },
            { label: "View → contact",     value: `${viewToContactPct}%`, sub: `Search → view ${searchToViewPct}%` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-border bg-surface-2 p-4">
              <p className="text-2xl font-semibold font-display">{typeof value === "number" ? value.toLocaleString() : value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
              {sub && <p className="text-[10px] text-muted/80 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Top search terms</h3>
            {topSearches.length === 0 ? (
              <p className="text-sm text-muted">No search submissions in the last 7 days.</p>
            ) : (
              <ul className="space-y-1.5">
                {topSearches.map((s, i) => (
                  <li key={`${s.q}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.q}</span>
                    <span className="text-xs text-muted tabular-nums">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Event totals</h3>
            {eventTotals.length === 0 ? (
              <p className="text-sm text-muted">No analytics events yet — events start landing as soon as users browse.</p>
            ) : (
              <ul className="space-y-1.5">
                {eventTotals.map((e) => (
                  <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{e.name.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {e.total.toLocaleString()} <span className="opacity-60">· {e.sessions} sess.</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── PR9 + policy: Listing compliance ── */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-1 gap-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Listing compliance
          </h2>
          <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 ${
            nonCompliant.length === 0
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}>
            {nonCompliant.length === 0 ? "All clear" : `${nonCompliant.length} flagged`}
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          Active listings, by status against the publish bar (≥10 photos, 11–20 char VIN).
          Policy cutoff: <span className="font-mono">{QUALITY_POLICY_CUTOFF}</span> — listings created before this date are grandfathered and remain publicly visible.
        </p>

        {/* Four-number strip — track migration readiness from Option A → Option B.
            Total = Compliant + Grandfathered + Hidden (all active rows). */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-2xl font-semibold font-display tabular-nums">
              {(complianceStats.compliant + complianceStats.grandfathered + complianceStats.hidden).toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">Total active</p>
            <p className="text-[10px] text-muted/80 mt-0.5">All status=active rows</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-2xl font-semibold font-display tabular-nums">{complianceStats.compliant.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">Compliant</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Visible · meets bar</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-2xl font-semibold font-display tabular-nums">{complianceStats.grandfathered.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">Grandfathered</p>
            <p className="text-[10px] text-muted/80 mt-0.5">Pre-cutoff · visible</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-2xl font-semibold font-display tabular-nums">{complianceStats.hidden.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">Hidden non-compliant</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Post-cutoff · failing bar</p>
          </div>
        </div>

        {nonCompliant.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">
            Every active listing currently meets the quality requirements.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold">Listing</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold hidden md:table-cell">Dealer</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold">Missing</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold hidden sm:table-cell">Last updated</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold">View</th>
                </tr>
              </thead>
              <tbody>
                {nonCompliant.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate">{row.year} {row.make} {row.model}</p>
                      <p className="text-[11px] text-muted font-mono truncate">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">{row.dealerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.missingPhotos && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                            <ImageOff className="h-2.5 w-2.5" />
                            {row.photoCount}/10 photos
                          </span>
                        )}
                        {row.missingVin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                            <FileWarning className="h-2.5 w-2.5" />
                            {row.vinLength === 0 ? "no VIN" : `VIN ${row.vinLength}/11`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted">
                      {new Date(row.updatedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/cars/${row.slug}`}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Charts row ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Revenue over 6 months — line */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-sm mb-1">Revenue from sold listings</h2>
          <p className="text-xs text-muted mb-5">
            KSh {formatPrice(revenueByMonth.reduce((s, r) => s + r.revenue, 0))} last {N} months
          </p>
          <LineChart
            points={revenueByMonth.map((r) => ({ label: r.label, value: r.revenue }))}
            color="#FF4D2E"
          />
        </div>

      </div>

      {/* ── User growth + Views row ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* User growth — bar */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-sm mb-1">New users per month</h2>
          <p className="text-xs text-muted mb-5">
            {userGrowth.reduce((s, r) => s + r.count, 0)} new users in last {N} months
          </p>
          <BarChart
            points={userGrowth.map((r) => ({ label: r.label, value: r.count }))}
            color="#3b82f6"
          />
        </div>

        {/* 30-day views — bar */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">Car page views — 30 days</h2>
          </div>
          <p className="text-xs text-muted mb-5">
            {dailyViews.reduce((s, d) => s + Number(d.views), 0).toLocaleString()} total views
          </p>
          <div className="flex items-end gap-0.5 h-[96px]">
            {dailyViews.length === 0 ? (
              <EmptyChart />
            ) : dailyViews.map((d) => {
              const h = (Number(d.views) / maxViews) * 96;
              const dt = new Date(d.date);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group">
                  <div className="relative w-full" style={{ height: "86px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-accent/65 group-hover:bg-accent transition-colors min-h-[2px]"
                      style={{ height: `${Math.max(h, 2)}px` }}
                      title={`${d.views} views on ${d.date}`}
                    />
                  </div>
                  {dt.getDate() % 5 === 1 && (
                    <span className="text-[7px] text-muted">{dt.getDate()}/{dt.getMonth() + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Listings table (static, server-rendered) ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-muted" />
          <h2 className="font-semibold">All listings</h2>
          <span className="text-xs text-muted">({listings.length} total)</span>
        </div>
        <ListingsTable rows={listings} />
      </div>

    </div>
  );
}
