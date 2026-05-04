import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Car, Eye, MessageCircle, TrendingUp, PlusCircle,
  ArrowRight, Clock, Zap, BarChart3,
} from "lucide-react";
import {
  getDealerByUserId, getDealerCars, getDealerDailyViews,
  getPrivateSellerByUserId, getSellerCars, getSellerDailyViews,
  getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan } from "@/lib/subscriptions";
import { formatPrice, cn } from "@/lib/utils";
import type { DealerCar } from "@/types";

// ── helpers ──────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent,
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className={cn(
        "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl",
        accent ? "bg-accent-soft" : "bg-surface-2",
      )}>
        <Icon className={cn("h-5 w-5", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active",  cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    draft:  { label: "Draft",   cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    sold:   { label: "Sold",    cls: "bg-surface-2 text-muted" },
  };
  const { label, cls } = map[status] ?? map.active;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
}

// Build a 14-entry date→views map from DB rows
function buildChartData(
  rows: { date: string; views: string }[],
  days = 14,
): { date: string; label: string; views: number }[] {
  const map = new Map(rows.map((r) => [r.date, Number(r.views)]));
  const result: { date: string; label: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
    result.push({ date: key, label, views: map.get(key) ?? 0 });
  }
  return result;
}

// ── page ─────────────────────────────────────────────────────

export default async function DealerDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  let cars: DealerCar[] = [];
  let dailyViewRows: { date: string; views: string }[] = [];
  let displayName = session.user.name ?? "Dashboard";
  let planId = "free";

  if (isDbConfigured()) {
    try {
      if (role === "dealer") {
        const dealer = await getDealerByUserId(session.user.id);
        if (!dealer) redirect("/dealer/register");
        if (dealer.status === "rejected") redirect("/dealer/rejected");
        if (dealer.status === "pending") {
          // Show minimal dashboard for pending dealers
          displayName = dealer.businessName;
        } else {
          displayName = dealer.businessName;
          [cars, dailyViewRows] = await Promise.all([
            getDealerCars(dealer.id),
            getDealerDailyViews(dealer.id, 14),
          ]);
        }
      } else if (role === "private_seller") {
        const seller = await getPrivateSellerByUserId(session.user.id);
        if (!seller) redirect("/seller/register");
        displayName = session.user.name ?? "Private Seller";
        [cars, dailyViewRows] = await Promise.all([
          getSellerCars(session.user.id),
          getSellerDailyViews(session.user.id, 14),
        ]);
      }
      const sub = await getSubscription(session.user.id);
      planId = sub?.plan ?? "free";
    } catch {
      // fall through with empty data
    }
  }

  const plan = getPlan(planId);
  const activeCars = cars.filter((c) => c.status === "active");
  const totalViews = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const totalInquiries = cars.reduce((s, c) => s + (c.inquiries ?? 0), 0);
  const avgViews = activeCars.length > 0 ? Math.round(totalViews / activeCars.length) : 0;
  const conversionRate = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : "0.0";

  const chartData = buildChartData(dailyViewRows, 14);
  const maxViews = Math.max(...chartData.map((d) => d.views), 1);

  const topCars = [...cars]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Dashboard</h1>
          <p className="text-muted mt-0.5 text-sm">{displayName}</p>
        </div>
        <Link
          href="/dealer/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <PlusCircle className="h-4 w-4" /> Add listing
        </Link>
      </div>

      {/* Plan upgrade banner */}
      {planId === "free" && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-sm">Unlock more with Pro</p>
              <p className="text-xs text-muted">25 listings, featured slots, full analytics & AI chat — KSh 2,999/mo</p>
            </div>
          </div>
          <Link
            href="/dealer/subscription"
            className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Upgrade <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Car}           label="Active listings"  value={activeCars.length}           sub={`${cars.length} total`} accent />
        <StatCard icon={Eye}           label="Total views"      value={totalViews.toLocaleString()}  sub="All time" />
        <StatCard icon={MessageCircle} label="Inquiries"        value={totalInquiries}               sub="Buyer contacts" />
        <StatCard icon={TrendingUp}    label="Avg views / car"  value={avgViews}                     sub={`${conversionRate}% conversion`} />
      </div>

      {/* 14-day views chart */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">Views — last 14 days</h2>
          </div>
          <span className="text-xs text-muted">{chartData.reduce((s, d) => s + d.views, 0)} total</span>
        </div>

        {planId === "free" ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="h-10 w-10 rounded-xl bg-surface-2 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-muted" />
            </div>
            <p className="text-sm font-medium">Full analytics on Pro</p>
            <p className="text-xs text-muted text-center max-w-xs">
              Upgrade to see day-by-day view trends, top performing listings, and more.
            </p>
            <Link
              href="/dealer/subscription"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent text-accent px-4 text-xs font-semibold hover:bg-accent/5 transition-colors"
            >
              Upgrade to Pro <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {chartData.map(({ date, label, views }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className="bar-fill w-full rounded-t bg-accent/80 group-hover:bg-accent transition-colors min-h-[2px]"
                    style={{ "--bar-h": `${Math.max((views / maxViews) * 100, views > 0 ? 4 : 0)}%` } as React.CSSProperties}
                  />
                  {views > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {views}
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-muted hidden sm:block whitespace-nowrap overflow-hidden max-w-full">
                  {label.split(" ")[1]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top performing cars */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Top performing listings</h2>
          <Link
            href="/dealer/listings"
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {cars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Car className="h-10 w-10 text-muted mx-auto mb-3" />
            <p className="font-medium mb-1">No listings yet</p>
            <p className="text-sm text-muted mb-5">Start adding cars to your inventory</p>
            <Link
              href="/dealer/listings/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
            >
              <PlusCircle className="h-4 w-4" /> Add your first car
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Car</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden sm:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">Views</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">Inquiries</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {topCars.map((car) => (
                  <tr key={car.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{car.year} {car.make} {car.model}</p>
                      <p className="text-xs text-muted">{car.location}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-medium text-accent">
                      KSh {formatPrice(car.price)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">{car.views ?? 0}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted">{car.inquiries ?? 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={car.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick tips */}
      <div className="rounded-2xl border border-border bg-surface-2 p-5">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Tips for faster sales</p>
            <ul className="text-sm text-muted space-y-1">
              <li>• Add at least 4 high-quality photos per listing</li>
              <li>• Include a detailed description with service history</li>
              <li>• Respond to buyer inquiries within 2 hours</li>
              <li>• Price within 5% of market rate to get more views</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
