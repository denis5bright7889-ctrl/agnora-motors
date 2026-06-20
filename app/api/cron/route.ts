import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/news/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const regions = ["kenya", "east-africa", "africa", "global"] as const;

  const results = await Promise.allSettled(
    regions.map((region) => runPipeline(region, { useAi: true }))
  );

  const summary = Object.fromEntries(
    regions.map((region, i) => {
      const outcome = results[i];
      return [
        region,
        outcome.status === "fulfilled"
          ? { ok: true, data: outcome.value }
          : { ok: false, error: String(outcome.reason) },
      ];
    })
  );

  return NextResponse.json(summary);
}
