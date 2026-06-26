import { requireSeller } from "@/lib/api/guards";
import { ok } from "@/lib/api/respond";
import { vehicleDTO } from "@/lib/api/dto";
import { getSellerCars, getInquiriesForSeller, getSellerAccountHealth } from "@/lib/db";

export const runtime = "nodejs";

// Private-seller home — listings, views, enquiries, verification & account health.
export async function GET() {
  const g = await requireSeller();
  if (!g.ok) return g.response;

  const [cars, enquiries, health] = await Promise.all([
    getSellerCars(g.userId),
    getInquiriesForSeller(g.userId),
    getSellerAccountHealth(g.userId),
  ]);

  const active = cars.filter((c) => c.status === "active");
  return ok({
    verified: Boolean(g.seller.verified),
    status: health ? (health.isActive ? "active" : "suspended") : "active",
    strikeCount: health?.strikeCount ?? 0,
    metrics: {
      activeListings: active.length,
      totalListings: cars.length,
      totalViews: cars.reduce((s, c) => s + (c.views ?? 0), 0),
      enquiries: enquiries.length,
    },
    vehicles: cars.map(vehicleDTO),
  });
}
