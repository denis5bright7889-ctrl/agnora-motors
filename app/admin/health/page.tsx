import {
  ShieldCheck, Car, Eye, MousePointerClick, MessageCircle,
  Trophy, Gauge, Clock, AlertTriangle, Activity,
  ScanLine, CheckCircle2, PencilLine, Zap, Sparkles, ArrowUp, ArrowDown,
} from "lucide-react";
import { getMarketplaceHealth, isDbConfigured, type MarketplaceHealth } from "@/lib/db";
import { getVinDecodeQuality, type VinDecodeQuality } from "@/lib/vin-corrections";
import { cn } from "@/lib/utils";

export const metadata = { title: "Marketplace Health — Admin" };

// Executive view of marketplace health. Supply → traffic → intent → demand →
// conversion → trust/service quality. Watch the trend, not the snapshot.
export default async function AdminHealthPage() {
  let h: MarketplaceHealth | null = null;
  let vin: VinDecodeQuality | null = null;
  if (isDbConfigured()) {
    [h, vin] = await Promise.all([
      getMarketplaceHealth().catch(() => null),
      getVinDecodeQuality().catch(() => null),
    ]);
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

      {/* VIN decode quality — measures the data layer, not just the market. */}
      {vin && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5" /> VIN data quality
          </h2>
          {vin.totalDecodes === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
              No VIN decodes yet — metrics appear once sellers start decoding VINs.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <VinKpi icon={CheckCircle2} label="Decode success" value={pct(vin.decodeSuccessRate)} trend={vin.successTrendPts} goodUp accent />
                <VinKpi icon={AlertTriangle} label="Partial decodes" value={pct(vin.partialRate)} />
                <VinKpi icon={PencilLine} label="Manual corrections" value={pct(vin.manualCorrectionRate)} trend={vin.correctionTrendPts} goodUp={false} />
                <VinKpi icon={Gauge} label="Avg confidence" value={vin.avgConfidence != null ? `${Math.round(vin.avgConfidence)}%` : "—"} />
                <VinKpi icon={Zap} label="EV decode success" value={pct(vin.evSuccessRate)} hint={`${vin.evDecodes} EV decodes`} />
                <VinKpi icon={Sparkles} label="Learning patterns" value={String(vin.approvedPatterns)} hint={`${vin.learnedApplied} learned applies`} accent />
              </div>
              {vin.topCorrectedMakes.length > 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
                  <h3 className="font-semibold text-sm mb-2">Most-corrected makes</h3>
                  <p className="text-xs text-muted mb-3">Where the WMI/decoder rules most need improvement.</p>
                  <div className="flex flex-wrap gap-2">
                    {vin.topCorrectedMakes.map((m) => (
                      <span key={m.make} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs">
                        {m.make} <span className="font-semibold text-muted">{m.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted mt-3">
                The goal: decode-success trending up and manual corrections trending down as the learning loop matures.
                Revisit a paid VIN API only if success stays low and corrections stay high.
              </p>
            </>
          )}
        </section>
      )}

      <p className="text-xs text-muted">
        These are lifetime totals/averages. As real dealers and buyers come on, watch the trend —
        rising conversion, dealer score and falling response/resolution times mean a healthier marketplace.
      </p>
    </div>
  );
}

// VIN KPI with an optional trend chip. `goodUp` controls colour: success
// rising is good (green up); corrections rising is bad (red up).
function VinKpi({ icon: Icon, label, value, hint, trend, goodUp, accent }: {
  icon: React.ElementType; label: string; value: string; hint?: string;
  trend?: number | null; goodUp?: boolean; accent?: boolean;
}) {
  const showTrend = trend != null && trend !== 0;
  const up = (trend ?? 0) > 0;
  const positive = goodUp ? up : !up;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className={cn("mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl", accent ? "bg-accent-soft" : "bg-surface-2")}>
        <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-muted")} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-xl font-semibold font-display">{value}</p>
        {showTrend && (
          <span className={cn("inline-flex items-center text-[11px] font-semibold", positive ? "text-green-600 dark:text-green-400" : "text-red-500")}>
            {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(trend!)}pt
          </span>
        )}
      </div>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
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
