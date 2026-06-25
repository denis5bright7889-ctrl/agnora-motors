import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  Eye, MousePointerClick, Phone, MessageCircle, TrendingUp, Clock,
  Smartphone, Monitor, Tablet, ArrowRight, Trophy, AlertTriangle, Lock,
} from "lucide-react";
import { getDealerByUserId, isDbConfigured } from "@/lib/db";
import {
  getDealerAnalytics, getDealerBenchmark, type DealerAnalytics,
  BENCHMARK_MIN_DEALERS, BENCHMARK_MIN_LEADS,
} from "@/lib/analytics-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Performance — Dealer Control Center" };

const SOURCE_LABELS: Record<string, string> = {
  vehicle_page: "Vehicle page", homepage: "Homepage", search_results: "Search",
  featured_listing: "Featured", dealer_profile: "Dealer page", shared_link: "Shared link",
  listing: "Listing",
};
const DEVICE_ICON: Record<string, typeof Smartphone> = {
  mobile: Smartphone, desktop: Monitor, tablet: Tablet,
};

export default async function DealerAnalyticsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "private_seller") redirect("/dashboard/seller");
  if (session.user.role !== "dealer" && session.user.role !== "admin") redirect("/");

  let data: DealerAnalytics | null = null;
  let benchmark: Awaited<ReturnType<typeof getDealerBenchmark>> | null = null;

  if (isDbConfigured() && session.user.role === "dealer") {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    data = await getDealerAnalytics(dealer.id);
    benchmark = await getDealerBenchmark(dealer.id, data.totals.conversionRate);
  }

  if (!data) {
    return <Shell><p className="text-muted text-sm">Analytics are unavailable right now.</p></Shell>;
  }

  const { totals, funnel, sources, devices, vehicles } = data;
  const noActivity = totals.views === 0 && totals.leads === 0;

  return (
    <Shell>
      {noActivity ? (
        <NoActivityState />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Eye} label="Inventory views" value={totals.views.toLocaleString()} accent />
            <Kpi icon={MousePointerClick} label="Contact opens" value={totals.contactOpens.toLocaleString()} />
            <Kpi icon={Phone} label="Phone reveals" value={totals.phoneReveals.toLocaleString()} />
            <Kpi icon={MessageCircle} label="Leads" value={totals.leads.toLocaleString()}
              sub={growthLabel(totals.leadGrowthPct)} />
            <Kpi icon={TrendingUp} label="Conversion" value={pct(totals.conversionRate)} sub="Leads / views" accent />
            <Kpi icon={Clock} label="Avg response"
              value={totals.avgResponseHours !== null ? fmtHours(totals.avgResponseHours) : "—"}
              sub={totals.avgResponseHours !== null ? "Lead → first reply" : "No replies yet"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Funnel */}
            <Card title="Conversion funnel" subtitle="Where buyers drop off">
              {totals.views === 0 ? (
                <EmptyHint icon={Eye} title="No traffic detected yet"
                  lines={["Feature a listing", "Complete your dealer profile", "Add vehicle photos & videos"]} />
              ) : (
                <Funnel steps={funnel} />
              )}
            </Card>

            {/* Traffic sources + devices */}
            <div className="space-y-6">
              <Card title="Traffic sources" subtitle="Where your leads come from">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted py-4 text-center">No leads yet — sources appear once buyers enquire.</p>
                ) : (
                  <BarList items={sources.map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, value: s.count }))} />
                )}
              </Card>

              <Card title="Devices" subtitle="How buyers view your inventory">
                {devices.length === 0 ? (
                  <p className="text-sm text-muted py-4 text-center">No views yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {devices.map((d) => {
                      const total = devices.reduce((s, x) => s + x.count, 0);
                      const Icon = DEVICE_ICON[d.device] ?? Monitor;
                      return (
                        <div key={d.device} className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted shrink-0" />
                          <span className="text-sm capitalize w-16">{d.device}</span>
                          <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${(d.count / total) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted w-10 text-right">{pct(d.count / total)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Vehicle performance */}
          <Card title="Vehicle performance" subtitle="Views, intent and conversion per listing">
            {vehicles.length === 0 ? (
              <EmptyHint icon={MessageCircle} title="No vehicles to analyse"
                lines={["Add at least 3 vehicles", "Upload 15+ photos per vehicle", "Complete dealer verification"]} />
            ) : (
              <VehicleTable vehicles={vehicles} />
            )}
          </Card>

          {/* Benchmarking (gated) */}
          {benchmark && <Benchmark b={benchmark} />}
        </>
      )}
    </Shell>
  );
}

// ── shell + sections ─────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Performance</h1>
        <p className="text-muted mt-0.5 text-sm">Buyer intent, funnel and conversion across your inventory</p>
      </div>
      {children}
    </div>
  );
}

function NoActivityState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10">
      <div className="max-w-md mx-auto text-center">
        <div className="h-12 w-12 rounded-2xl bg-accent-soft mx-auto mb-4 flex items-center justify-center">
          <TrendingUp className="h-6 w-6 text-accent" />
        </div>
        <h2 className="font-display text-xl font-medium mb-2">No activity yet</h2>
        <p className="text-sm text-muted mb-6">
          Your analytics light up as buyers view and enquire. Here's how to get your first leads:
        </p>
        <ol className="text-left space-y-2.5 mb-7">
          {[
            "Add at least 3 vehicles to your inventory",
            "Upload 15+ clear photos per vehicle",
            "Complete dealer verification for the trust badge",
            "Share your listings on WhatsApp and socials",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="h-5 w-5 shrink-0 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <Link href="/dealer/listings/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
          Add a vehicle <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function EmptyHint({ icon: Icon, title, lines }: { icon: React.ElementType; title: string; lines: string[] }) {
  return (
    <div className="py-6 text-center">
      <Icon className="h-8 w-8 text-muted/40 mx-auto mb-3" />
      <p className="font-medium text-sm mb-3">{title}</p>
      <ul className="text-xs text-muted space-y-1.5 inline-block text-left">
        {lines.map((l) => (
          <li key={l} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent" /> {l}</li>
        ))}
      </ul>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0]?.value || 1;
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const widthPct = Math.max((s.value / top) * 100, s.value > 0 ? 3 : 0);
        const prev = steps[i - 1]?.value;
        const drop = prev && prev > 0 ? 1 - s.value / prev : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted">
                {s.value.toLocaleString()}
                {drop !== null && drop > 0 && <span className="text-red-500 ml-1.5">−{pct(drop)}</span>}
              </span>
            </div>
            <div className="h-7 rounded-lg bg-surface-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-lg flex items-center px-2" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="text-sm w-24 truncate">{it.label}</span>
          <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <span className="text-xs text-muted w-8 text-right">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function VehicleTable({ vehicles }: { vehicles: DealerAnalytics["vehicles"] }) {
  const byViews = [...vehicles].sort((a, b) => b.views - a.views);
  // Underperformers: meaningful traffic but no leads.
  const underperformers = vehicles.filter((v) => v.views >= 10 && v.leads === 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <Th>Vehicle</Th><Th className="text-right">Views</Th>
              <Th className="text-right hidden sm:table-cell">Phone</Th>
              <Th className="text-right">Leads</Th><Th className="text-right">Conv.</Th>
            </tr>
          </thead>
          <tbody>
            {byViews.map((v) => (
              <tr key={v.carId} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-2"><span className="font-medium">{v.label}</span></td>
                <td className="py-2.5 text-right tabular-nums">{v.views}</td>
                <td className="py-2.5 text-right tabular-nums hidden sm:table-cell">{v.phoneReveals}</td>
                <td className="py-2.5 text-right tabular-nums">{v.leads}</td>
                <td className="py-2.5 text-right tabular-nums">{v.views > 0 ? pct(v.conversion) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {underperformers.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted">
            <span className="font-semibold text-foreground">{underperformers.length} listing{underperformers.length > 1 ? "s" : ""}</span> are
            getting views but no leads — consider revisiting price, photos or description.
          </p>
        </div>
      )}
    </div>
  );
}

function Benchmark({ b }: { b: Awaited<ReturnType<typeof getDealerBenchmark>> }) {
  if (!b.unlocked) {
    return (
      <Card title="Dealer benchmarking" subtitle="See how you compare to the marketplace">
        <div className="flex items-start gap-3 py-2">
          <div className="h-9 w-9 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-muted" />
          </div>
          <div>
            <p className="text-sm font-medium">Unlocks at marketplace scale</p>
            <p className="text-xs text-muted mt-0.5">
              Comparisons need at least {BENCHMARK_MIN_DEALERS} active dealers and {BENCHMARK_MIN_LEADS} leads to be
              statistically meaningful. Currently {b.dealers} dealer{b.dealers === 1 ? "" : "s"} · {b.leads} lead{b.leads === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card title="Dealer benchmarking" subtitle="You vs the marketplace">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1"><Trophy className="h-3.5 w-3.5" /> Your conversion</div>
          <p className="font-display text-2xl font-semibold text-accent">{pct(b.yourConversion)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-xs text-muted mb-1">Marketplace average</p>
          <p className="font-display text-2xl font-semibold">{b.marketplaceConversion !== null ? pct(b.marketplaceConversion) : "—"}</p>
        </div>
      </div>
    </Card>
  );
}

// ── primitives ───────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-sm">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className={cn("mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl", accent ? "bg-accent-soft" : "bg-surface-2")}>
        <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-xl font-semibold font-display">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("py-2 font-semibold text-[11px] uppercase tracking-wider text-muted", className)}>{children}</th>;
}

// ── format helpers ───────────────────────────────────────────

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;
}
function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}
function growthLabel(g: number | null): string {
  if (g === null) return "Last 30 days";
  const sign = g >= 0 ? "+" : "";
  return `${sign}${Math.round(g)}% vs prev 30d`;
}
