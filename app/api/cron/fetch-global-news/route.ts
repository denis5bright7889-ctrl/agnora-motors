import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/news/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Global also fetches RSS feeds — allow extra time
  const result = await runPipeline("global", { useAi: true });
  return NextResponse.json(result);
}
