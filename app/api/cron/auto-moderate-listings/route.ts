import { NextResponse } from "next/server";
import { autoModerateListings } from "@/lib/auto-moderate";

export const runtime = "nodejs";
export const maxDuration = 120;

// Nightly auto-moderation. Same bearer-token shape as the news crons so
// Vercel's cron scheduler can hit it with CRON_SECRET. Accepts ?dryRun=1
// for manual sanity checks without writing anything.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const result = await autoModerateListings({ dryRun });
  return NextResponse.json({ ok: true, dryRun, ...result });
}
