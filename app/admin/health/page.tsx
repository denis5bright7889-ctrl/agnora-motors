import {
  ShieldCheck, Car, Eye, MousePointerClick, MessageCircle,
  Trophy, Gauge, Clock, AlertTriangle, Activity,
} from "lucide-react";
import { getMarketplaceHealth, isDbConfigured, type MarketplaceHealth } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Marketplace Health — Admin" };

// Executive view of marketplace health. Supply → traffic → intent → demand →
// conversion → trust/service quality. Watch the trend, not the snapshot.
export default async function AdminHealthPage() {
  let h: MarketplaceHealth | null = null;
  if (isDbConfigured()) {
    h = await getMarketplaceHealth().catch(() => null);
  }

  if (!h) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium">Marketplace Health</h1>
        <p className="text-sm text-muted">Metrics are unavailable right now.</p>
      </div>
    );
  }

  const groups: { title: string; items: { icon: React.ElementType; label: string; value: string; hint: string }[] }[] = [
    {
      title: "Supply & traffic",
      items: [
        { icon: ShieldCheck, label: "Active dealers", value: h.activeDealers.toLocaleString(), hint: "Marketplace growth" },
        { icon: Car, label: "Active listings", value: h.activeListings.toLocaleString(), hint: "Supply" },
        { icon: Eye, label: "Listing views", value: h.listingViews.toLocaleString(), hint: "Traffic" },
      ],
    },
    {
      title: "Demand & conversion",
      items: [
        { icon: MousePointerClick, label: "Contact form opens", value: h.contactOpens.toLocaleString(), hint: "Buyer intent" },
        { icon: MessageCircle, label: "Leads created", value: h.leads.toLocaleString(), hint: "Demand" },
        { icon: Trophy, label: "Lead-to-sale conversion", value: pct(h.leadConversion), hint: `${h.wonLeads} won` },
      ],
    },
    {
      title: "Trust & service quality",
      items: [
        { icon: Gauge, label: "Avg dealer score", value: h.avgDealerScore != null ? `${h.avgDealerScore.toFixed(0)}/100` : "—", hint: "Trust quality" },
        { icon: Clock, label: "Avg response time", value: fmtHours(h.avgResponseHours), hint: "Service quality" },
        { icon: AlertTriangle, label: "Complaint resolution", value: fmtHours(h.avgResolutionHours), hint: "Operational quality" },
      ],
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-medium flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" /> Marketplace Health
        </h1>
        <p className="text-sm text-muted mt-0.5">Executive view of whether the marketplace is getting healthier over time.</p>
      </div>

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">{g.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {g.items.map((it) => (
              <div key={it.label} className="rounded-2xl border border-border bg-surface p-5">
                <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2")}>
                  <it.icon className="h-5 w-5 text-accent" />
                </div>
                <p className="text-2xl font-semibold font-display">{it.value}</p>
                <p className="text-sm font-medium mt-0.5">{it.label}</p>
                <p className="text-xs text-muted mt-0.5">{it.hint}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted">
        These are lifetime totals/averages. As real dealers and buyers come on, watch the trend —
        rising conversion, dealer score and falling response/resolution times mean a healthier marketplace.
      </p>
    </div>
  );
}

function pct(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;
}

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} hrs`;
  return `${Math.round(h / 24)} days`;
}
