import { requireAdmin } from "@/lib/api/guards";
import { ok } from "@/lib/api/respond";
import { getMarketplaceHealth } from "@/lib/db";
import { getVinDecodeQuality } from "@/lib/vin-corrections";

export const runtime = "nodejs";

// Executive marketplace + data-quality health (admin only).
export async function GET() {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const [marketplace, vin] = await Promise.all([
    getMarketplaceHealth(),
    getVinDecodeQuality(),
  ]);
  return ok({ marketplace, vin });
}
