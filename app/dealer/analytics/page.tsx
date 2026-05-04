import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BarChart3, Eye, MessageCircle, TrendingUp, ArrowRight, Zap } from "lucide-react";
import {
  getDealerByUserId, getDealerCars, getDealerDailyViews,
  getPrivateSellerByUserId, getSellerCars, getSellerDailyViews,
  getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan, hasFullAnalytics } from "@/lib/subscriptions";
import { formatPrice, cn } from "@/lib/utils";
import type { DealerCar } from "@/types";
import Link from "next/link";

function buildChartData(
  rows: { date: string; views: string }[],
  days = 30,
): { date: string; label: string; views: number }[] {
  const map = new Map(rows.map((r) => [r.date, Number(r.views)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key   = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
    return { date: key, label, views: map.get(key) ?? 0 };
  });
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  let cars: DealerCar[] = [];
  let dailyRows: { date: string; views: string }[] = [];
  let planId = "free";

  if (isDbConfigured()) {
    try {
      if (role === "dealer") {
        const dealer = await getDealerByUserId(session.user.id);
        if (!dealer) redirect("/dealer/register");
        if (dealer.status === "approved") {
          [cars, dailyRows] = await Promise.all([
            getDealerCars(dealer.id),
            getDealerDailyViews(dealer.id, 30),
          ]);
        }
      } else if (role === "private_seller") {
        const seller = await getPrivateSellerByUserId(session.user.id);
        if (!seller) redirect("/seller/register");
        [cars, dailyRows] = await Promise.all([
          getSellerCars(session.user.id),
          getSellerDailyViews(session.user.id, 30),
        ]);
      }
      const sub = await getSubscription(session.user.id);
      planId = sub?.plan ?? "free";
    } catch {
      // fall through
    }
  }

  const plan = getPlan(planId);
  const fullAnalytics = hasFullAnalytics(planId as "free" | "pro" | "premium");

  const totalViews      = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const totalInquiries  = cars.reduce((s, c) => s + (c.inquiries ?? 0), 0);
  const activeCars      = cars.filter((c) => c.status === "active");
  const convRate        = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : "0.0";

  const chartData = buildChartData(dailyRows, 30);
  const maxViews  = Math.max(...chartData.map((d) => d.views), 1);

  const topByViews     = [...cars].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10);
  const topByInquiries = [...cars].sort((a, b) => (b.inquiries ?? 0) - (a.inquiries ?? 0)).slice(0, 5);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium">Analytics</h1>
        <p className="text-muted mt-1 text-sm">{plan.name} plan · last 30 days</p>
      </div>

      {/* Upgrade prompt for free users */}
      {!fullAnalytics && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-sm">Full analytics on Pro &amp; Premium</p>
              <p className="text-xs text-muted">30-day trends, per-car breakdown, conversion funnel — KSh 2,999/mo</p>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Eye,           label: "Total views",     value: totalViews.toLocaleString() },
          { icon: MessageCircle, label: "Total inquiries", value: totalInquiries },
          { icon: TrendingUp,    label: "Conversion rate", value: `${convRate}%` },
          { icon: BarChart3,     label: "Active listings", value: activeCars.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
              <Icon className="h-5 w-5 text-muted" />
            </div>
            <p className="text-2xl font-semibold font-display">{value}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* 30-day trend chart */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted" />
            <h2 className="font-semibold text-sm">Daily views — last 30 days</h2>
          </div>
          <span className="text-xs text-muted">{chartData.reduce((s, d) => s + d.views, 0)} total</span>
        </div>

        {!fullAnalytics ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <BarChart3 className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Upgrade to Pro to see daily trends</p>
          </div>
        ) : (
          <div className="flex items-end gap-0.5 h-40">
            {chartData.map(({ date, label, views }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className="bar-fill w-full rounded-t bg-accent/70 group-hover:bg-accent transition-colors min-h-[1px]"
                    style={{ "--bar-h": `${Math.max((views / maxViews) * 100, views > 0 ? 3 : 0)}%` } as React.CSSProperties}
                  />
                  {views > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-surface border border-border rounded px-1 py-0.5 z-10">
                      {views}
                    </span>
                  )}
                </div>
                {/* only show every ~5th label on mobile to avoid crowding */}
                <span className={cn(
                  "text-[7px] text-muted hidden sm:block whitespace-nowrap",
                  parseInt(date.slice(8)) % 5 !== 1 && "opacity-0",
                )}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-car breakdown */}
      <div>
        <h2 className="font-semibold mb-4">Per-listing breakdown</h2>
        {!fullAnalytics ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted">Upgrade to Pro to see per-listing stats</p>
            <Link
              href="/dealer/subscription"
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-accent text-accent px-4 text-xs font-semibold hover:bg-accent/5 transition-colors"
            >
              Upgrade to Pro <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : topByViews.length === 0 ? (
          <p className="text-sm text-muted">No listings yet.</p>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Listing</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden sm:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Views</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">Inquiries</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted hidden md:table-cell">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {topByViews.map((car) => {
                  const views     = car.views ?? 0;
                  const inqs      = car.inquiries ?? 0;
                  const conv      = views > 0 ? ((inqs / views) * 100).toFixed(0) : "0";
                  const barWidth  = maxViews > 0 ? Math.round((views / maxViews) * 100) : 0;
                  return (
                    <tr key={car.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{car.year} {car.make} {car.model}</p>
                        <div className="mt-1 h-1 rounded-full bg-surface-2 w-24">
                          <div
                            className="bar-fill h-1 rounded-full bg-accent"
                            style={{ "--bar-h": `1px`, width: `${barWidth}%` } as React.CSSProperties}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted">KSh {formatPrice(car.price)}</td>
                      <td className="px-4 py-3 font-medium">{views.toLocaleString()}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted">{inqs}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted">{conv}%</td>
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
