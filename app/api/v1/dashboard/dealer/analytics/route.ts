import { requireDealer } from "@/lib/api/guards";
import { ok } from "@/lib/api/respond";
import { getDealerAnalytics, getDealerBenchmark } from "@/lib/analytics-queries";

export const runtime = "nodejs";

// Dealer performance — KPIs, funnel, traffic sources, devices, per-vehicle,
// and gated benchmarking. Same data the web /dashboard/dealer/analytics renders.
export async function GET() {
  const g = await requireDealer();
  if (!g.ok) return g.response;

  const analytics = await getDealerAnalytics(g.dealer.id);
  const benchmark = await getDealerBenchmark(g.dealer.id, analytics.totals.conversionRate);

  return ok({ ...analytics, benchmark });
}
