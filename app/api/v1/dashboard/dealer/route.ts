import { requireDealer } from "@/lib/api/guards";
import { ok } from "@/lib/api/respond";
import { getDealerReputation, getDealerRanking } from "@/lib/reputation";

export const runtime = "nodejs";

// Dealer home — reputation, score breakdown, badges, ranking, KPIs.
export async function GET() {
  const g = await requireDealer();
  if (!g.ok) return g.response;

  const rep = await getDealerReputation(g.dealer.id);
  const ranking = await getDealerRanking(rep.score);

  return ok({
    business: { name: g.dealer.businessName, status: g.dealer.status },
    score: rep.score,
    band: rep.band,
    badges: rep.badges,
    explanation: rep.explanation,
    ranking,
    metrics: rep.metrics,
  });
}
