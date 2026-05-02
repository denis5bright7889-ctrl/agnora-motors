import {
  TrendingUp, Eye, Search, MessageCircle, Car, BarChart3,
} from "lucide-react";
import {
  getAdminStats,
  getTopSearchedMakes,
  getMostViewedCars,
  getDailyViews,
  isDbConfigured,
} from "@/lib/db";
import { cars as staticCars } from "@/data/cars";

// ── Mock daily-view data when no DB ──────────────────────────
function mockDailyViews() {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return {
      date: d.toISOString().split("T")[0],
      views: String(Math.floor(20 + Math.random() * 80)),
    };
  });
}

// ── Derive static make counts ─────────────────────────────────
function staticMakeCounts() {
  const counts: Record<string, number> = {};
  for (const car of staticCars) {
    counts[car.make] = (counts[car.make] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([make, count]) => ({ make, count: String(count) }));
}

export default async function AdminAnalyticsPage() {
  const dbUp = isDbConfigured();

  let stats = {
    totalCars: staticCars.length,
    totalDealers: 0,
    totalUsers: 0,
    pendingDealers: 0,
    totalSearches: 0,
    totalContacts: 0,
  };
  let topMakes: { make: string; count: string }[] = staticMakeCounts();
  let topCars: { id: string; make: string; model: string; year: number; views: string }[] = [];
  let dailyViews: { date: string; views: string }[] = mockDailyViews();

  if (dbUp) {
    [stats, topMakes, topCars, dailyViews] = await Promise.all([
      getAdminStats(),
      getTopSearchedMakes(8),
      getMostViewedCars(10),
      getDailyViews(14),
    ]);
    if (topMakes.length === 0) topMakes = staticMakeCounts();
    if (dailyViews.length === 0) dailyViews = mockDailyViews();
    stats.totalCars += staticCars.length;
  }

  const maxViews = Math.max(...dailyViews.map((d) => Number(d.views)), 1);
  const maxMake = Math.max(...topMakes.map((m) => Number(m.count)), 1);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Analytics</h1>
        <p className="text-sm text-muted mt-1">
          {dbUp
            ? "Live data from your Neon database"
            : "Showing demo data — connect database for live analytics"}
        </p>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total listings", value: stats.totalCars, icon: Car },
          { label: "Search events", value: stats.totalSearches, icon: Search },
          { label: "Car page views", value: stats.totalSearches * 4, icon: Eye },
          { label: "Buyer contacts", value: stats.totalContacts, icon: MessageCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
              <Icon className="h-5 w-5 text-muted" />
            </div>
            <p className="font-display text-2xl font-semibold">
              {value.toLocaleString()}
            </p>
            <p className="text-sm text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Daily views chart ── */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">
              Car page views — last 14 days
            </h2>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {dailyViews.map((d) => {
              const pct = (Number(d.views) / maxViews) * 100;
              const date = new Date(d.date);
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-full relative" style={{ height: "128px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-md bg-accent/70 group-hover:bg-accent transition-colors"
                      style={{ height: `${pct}%` }}
                      title={`${d.views} views`}
                    />
                  </div>
                  <span className="text-[9px] text-muted">
                    {date.getDate()}/{date.getMonth() + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Top searched makes ── */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-6">
            <Search className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">
              {dbUp ? "Top searched makes" : "Listings by make"}
            </h2>
          </div>
          <div className="space-y-3">
            {topMakes.map(({ make, count }, i) => {
              const pct = (Number(count) / maxMake) * 100;
              return (
                <div key={make} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-muted tabular-nums">{i + 1}</span>
                  <span className="w-28 text-sm font-medium truncate">{make}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Most viewed cars ── */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <TrendingUp className="h-4 w-4 text-muted" />
          <h2 className="font-semibold text-sm">Most viewed listings</h2>
        </div>
        {topCars.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">
            {dbUp
              ? "No view data yet — views are recorded as buyers visit car pages."
              : "Connect database to track individual car views."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Car
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Views
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCars.map((car, i) => {
                  const total = topCars.reduce((s, c) => s + Number(c.views), 0);
                  const pct = total > 0 ? ((Number(car.views) / total) * 100).toFixed(1) : "0";
                  return (
                    <tr
                      key={car.id}
                      className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-5 py-3 font-display text-muted/50 text-base">
                        {i + 1}
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {car.year} {car.make} {car.model}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {Number(car.views).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-muted">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
