import { requireDealer } from "@/lib/api/guards";
import { paginated } from "@/lib/api/respond";
import { parsePaging, pageSlice } from "@/lib/api/pagination";
import { leadDTO } from "@/lib/api/dto";
import { getDealerLeads, isLeadStage } from "@/lib/leads";

export const runtime = "nodejs";

// Dealer lead pipeline (list). ?status=<stage> filters; ?page=&limit= paginate.
export async function GET(req: Request) {
  const g = await requireDealer();
  if (!g.ok) return g.response;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  let leads = await getDealerLeads(g.dealer.id);
  if (statusFilter && isLeadStage(statusFilter)) {
    leads = leads.filter((l) => l.status === statusFilter);
  }

  const { page, limit } = parsePaging(req.url);
  const { items, pagination } = pageSlice(leads, page, limit);
  return paginated(items.map(leadDTO), pagination);
}
