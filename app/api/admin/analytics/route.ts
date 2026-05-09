import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAdminStats,
  getTotalRevenue,
  getRevenueByMonth,
  getUserGrowthByMonth,
  getListingStatusBreakdown,
  getTopDealersByActivity,
  getDailyViews,
  getTopSearchedMakes,
} from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

export async function GET(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const months = Math.min(Number(searchParams.get("months") ?? 6), 24);

  const [
    stats, totalRevenue, revenueByMonth, userGrowth,
    statusBreakdown, topDealers, dailyViews, topMakes,
  ] = await Promise.all([
    getAdminStats(),
    getTotalRevenue(),
    getRevenueByMonth(months),
    getUserGrowthByMonth(months),
    getListingStatusBreakdown(),
    getTopDealersByActivity(10),
    getDailyViews(30),
    getTopSearchedMakes(8),
  ]);

  return NextResponse.json({
    stats,
    totalRevenue,
    revenueByMonth,
    userGrowth,
    statusBreakdown,
    topDealers,
    dailyViews,
    topMakes,
    fetchedAt: new Date().toISOString(),
  });
}
