import {
  TrendingUp, Users, Car, DollarSign,
  Clock, BarChart3, Activity,
} from "lucide-react";
import {
  getAdminStats, getTotalRevenue,
  getRevenueByMonth, getUserGrowthByMonth,
  getListingStatusBreakdown, getTopDealersByActivity,
  getAdminListingsTable, getDailyViews,
  isDbConfigured,
} from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { ListingsTable } from "./listings-table";

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
  ] = await Promise.all([
    dbUp ? getAdminStats()                  : Promise.resolve({ totalCars: 0, totalDealers: 0, totalUsers: 0, pendingDealers: 0, totalSearches: 0, totalContacts: 0 }),
    dbUp ? getTotalRevenue()                : Promise.resolve(0),
    dbUp ? getRevenueByMonth(N)             : Promise.resolve([]),
    dbUp ? getUserGrowthByMonth(N)          : Promise.resolve([]),
    dbUp ? getListingStatusBreakdown()      : Promise.resolve([]),
    dbUp ? getTopDealersByActivity(10)      : Promise.resolve([]),
    dbUp ? getDailyViews(30)               : Promise.resolve([]),
    dbUp ? getAdminListingsTable({ limit: 200 }) : Promise.resolve([]),
  ]);

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

  return (
    <div className="space-y-10 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Analytics</h1>
          <p className="text-sm text-muted mt-1">
            {dbUp ? "Live data from your Neon database" : "⚠ No database — connect one for live analytics"}
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted">
          <Activity className="h-3 w-3" />
          {dbUp ? "DB connected" : "DB offline"}
        </span>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          label="Total revenue"
          value={`KSh ${formatPrice(totalRevenue)}`}
          sub="From sold listings"
          accent
        />
        <KpiCard icon={Car}   label="Total listings" value={stats.totalCars.toLocaleString()} />
        <KpiCard icon={Users} label="Total users"    value={stats.totalUsers.toLocaleString()} />
        <KpiCard
          icon={TrendingUp}
          label="Active dealers"
          value={stats.totalDealers.toLocaleString()}
        />
        <KpiCard
          icon={Clock}
          label="Pending approvals"
          value={stats.pendingDealers.toLocaleString()}
          sub="Dealer applications"
        />
      </div>

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

        {/* Listing status — donut */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold text-sm mb-5">Listings by status</h2>
          <div className="flex flex-col items-center gap-5">
            <DonutChart segments={donutSegments} />
            <div className="w-full space-y-2">
              {donutSegments.map((seg) => (
                <Legend key={seg.label} color={seg.color} label={seg.label} value={seg.value} />
              ))}
              {donutSegments.length === 0 && (
                <p className="text-xs text-muted text-center">No listings yet</p>
              )}
            </div>
          </div>
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

      {/* ── Dealer leaderboard ── */}
      {topDealers.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <TrendingUp className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">Top dealers by activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["#", "Dealer", "Location", "Total", "Active", "Sold", "Revenue (KSh)"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topDealers.map((d, i) => (
                  <tr key={d.dealerId} className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-3 text-muted/50 font-display">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{d.businessName}</td>
                    <td className="px-4 py-3 text-muted text-xs">{d.location}</td>
                    <td className="px-4 py-3 tabular-nums">{d.totalListings}</td>
                    <td className="px-4 py-3 tabular-nums text-green-500">{d.activeListings}</td>
                    <td className="px-4 py-3 tabular-nums text-blue-400">{d.soldListings}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-accent">
                      {d.revenue > 0 ? formatPrice(d.revenue) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Listings table ── */}
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
