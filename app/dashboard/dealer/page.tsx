import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  Car, Eye, MessageCircle, TrendingUp, Gauge, Clock,
  PlusCircle, ArrowRight, ShieldCheck, ShieldAlert, AlertTriangle,
  BarChart3, Image as ImageIcon,
} from "lucide-react";
import {
  getDealerByUserId, getDealerCars, getDealerDailyViews,
  getInquiriesForDealer, getDealerAccountHealth, isDbConfigured,
} from "@/lib/db";
import { computeDealerScore, MIN_PHOTOS } from "@/lib/dealer-score";
import { formatPrice, cn } from "@/lib/utils";
import type { DealerCar } from "@/types";

export const metadata = { title: "Dealer Control Center — Agnora Motors" };

export default async function DealerHomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "private_seller") redirect("/dashboard/seller");

  let cars: DealerCar[] = [];
  let leadCount = 0;
  let dailyViews: { date: string; views: string }[] = [];
  let verified = false;
  let strikeCount = 0;
  let lastStrikeAt: string | null = null;
  let suspended = false;
  let pending = false;

  if (isDbConfigured() && session.user.role === "dealer") {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    verified = dealer.status === "approved";
    pending = dealer.status === "pending";

    const [carsRes, leads, views, health] = await Promise.all([
      getDealerCars(dealer.id),
      getInquiriesForDealer(dealer.id),
      getDealerDailyViews(dealer.id, 14),
      getDealerAccountHealth(dealer.id),
    ]);
    cars = carsRes;
    leadCount = leads.length;
    dailyViews = views;
    strikeCount = health?.strikeCount ?? 0;
    lastStrikeAt = health?.lastStrikeAt ?? null;
    suspended = health ? !health.isActive : false;
  }

  const activeCars = cars.filter((c) => c.status === "active");
  const totalViews = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const conversion = totalViews > 0 ? ((leadCount / totalViews) * 100).toFixed(1) : "0.0";
  const listingsWithEnoughPhotos = activeCars.filter((c) => (c.images?.length ?? 0) >= MIN_PHOTOS).length;
  const missingPhotos = activeCars.length - listingsWithEnoughPhotos;

  const { score, band } = computeDealerScore({
    verified, strikeCount,
    activeListings: activeCars.length,
    listingsWithEnoughPhotos,
    totalViews, totalLeads: leadCount,
  });

  const chart = buildChart(dailyViews, 14);
  const maxViews = Math.max(...chart.map((d) => d.views), 1);
  const topCars = [...cars].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Control Center</h1>
          <p className="text-muted mt-0.5 text-sm">Inventory, leads, performance & reputation</p>
        </div>
        <Link
          href="/dealer/listings/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <PlusCircle className="h-4 w-4" /> Add car
        </Link>
      </div>

      {suspended && (
        <Banner tone="danger" icon={ShieldAlert}
          title="Your account is suspended"
          body="New active listings are blocked until an admin reinstates your account. Existing listings stay hidden." />
      )}
      {!suspended && pending && (
        <Banner tone="warn" icon={Clock}
          title="Verification pending"
          body="Your dealer account is under review. You can prepare inventory now — listings go live once approved." />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Car}           label="Active inventory" value={activeCars.length} sub={`${cars.length} total`} accent />
        <Kpi icon={Eye}           label="Total views"      value={totalViews.toLocaleString()} sub="All time" />
        <Kpi icon={MessageCircle} label="Total leads"      value={leadCount} sub="Buyer enquiries" />
        <Kpi icon={TrendingUp}    label="Conversion"       value={`${conversion}%`} sub="Leads / views" />
        <Kpi icon={Gauge}         label="Dealer score"     value={`${score}/100`} sub={band} accent />
        <Kpi icon={Clock}         label="Response rate"    value="—" sub="With Lead CRM" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Views chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted" />
              <h2 className="font-semibold text-sm">Views — last 14 days</h2>
            </div>
            <span className="text-xs text-muted">{chart.reduce((s, d) => s + d.views, 0)} total</span>
          </div>
          <div className="flex items-end gap-1 h-32">
            {chart.map(({ date, label, views }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className="w-full rounded-t bg-accent/80 group-hover:bg-accent transition-colors min-h-[2px]"
                    style={{ height: `${Math.max((views / maxViews) * 100, views > 0 ? 4 : 0)}%` }}
                  />
                  {views > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {views}
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-muted hidden sm:block">{label.split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Account health + inventory health */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-sm mb-3">Account health</h2>
            <div className="flex items-center gap-2 mb-3">
              {suspended ? (
                <ShieldAlert className="h-5 w-5 text-red-500" />
              ) : verified ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm font-medium">
                {suspended ? "Suspended" : verified ? "Verified & active" : "Pending review"}
              </span>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Row label="Strikes" value={`${strikeCount}/3`} warn={strikeCount > 0} />
              <Row label="Last strike" value={lastStrikeAt ? new Date(lastStrikeAt).toLocaleDateString("en-KE") : "None"} />
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-sm mb-3">Inventory health</h2>
            {activeCars.length === 0 ? (
              <p className="text-sm text-muted">No active listings yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {missingPhotos > 0
                    ? <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                    : <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />}
                  <span>
                    {missingPhotos > 0
                      ? `${missingPhotos} listing${missingPhotos > 1 ? "s" : ""} need more photos`
                      : "All listings have enough photos"}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-muted">
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  {listingsWithEnoughPhotos}/{activeCars.length} listings meet the {MIN_PHOTOS}+ photo bar
                </li>
              </ul>
            )}
            <Link href="/dealer/listings" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              Manage inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Top inventory */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Most viewed inventory</h2>
          <Link href="/dealer/listings" className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {cars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Car className="h-10 w-10 text-muted mx-auto mb-3" />
            <p className="font-medium mb-1">No inventory yet</p>
            <p className="text-sm text-muted mb-5">Add cars to start tracking views and leads.</p>
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
                  <Th>Vehicle</Th>
                  <Th className="hidden sm:table-cell">Price</Th>
                  <Th className="hidden md:table-cell">Views</Th>
                  <Th className="hidden md:table-cell">Leads</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {topCars.map((car) => (
                  <tr key={car.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{car.year} {car.make} {car.model}</p>
                      <p className="text-xs text-muted">{car.location}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-medium text-accent">KSh {formatPrice(car.price)}</td>
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
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────

function Kpi({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", accent ? "bg-accent-soft" : "bg-surface-2")}>
        <Icon className={cn("h-5 w-5", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted", className)}>{children}</th>;
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-medium", warn && "text-yellow-600 dark:text-yellow-400")}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    draft:  { label: "Draft",  cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    hidden: { label: "Hidden", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    sold:   { label: "Sold",   cls: "bg-surface-2 text-muted" },
  };
  const { label, cls } = map[status] ?? map.active;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{label}</span>;
}

function Banner({ tone, icon: Icon, title, body }: {
  tone: "danger" | "warn"; icon: React.ElementType; title: string; body: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl border px-5 py-4 flex items-start gap-3",
      tone === "danger" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5",
    )}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", tone === "danger" ? "text-red-500" : "text-yellow-500")} />
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted mt-0.5">{body}</p>
      </div>
    </div>
  );
}

// 14-entry date→views series, zero-filled.
function buildChart(rows: { date: string; views: string }[], days: number) {
  const map = new Map(rows.map((r) => [r.date, Number(r.views)]));
  const out: { date: string; label: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, label: d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }), views: map.get(key) ?? 0 });
  }
  return out;
}
