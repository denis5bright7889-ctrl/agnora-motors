import { requireAdmin } from "@/lib/api/guards";
import { paginated } from "@/lib/api/respond";
import { parsePaging, pageSlice } from "@/lib/api/pagination";
import { listCorrectionPatterns } from "@/lib/vin-corrections";

export const runtime = "nodejs";

// VIN learning patterns for admin review. ?status=pending|approved|rejected,
// ?page=&limit= paginate. (Quality stats live on /api/v1/admin/health.)
export async function GET(req: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const patterns = await listCorrectionPatterns(status);

  const { page, limit } = parsePaging(req.url, 50);
  const { items, pagination } = pageSlice(patterns, page, limit);
  return paginated(items, pagination);
}
