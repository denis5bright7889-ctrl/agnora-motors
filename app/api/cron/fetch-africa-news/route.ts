import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/news/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPipeline("africa", { useAi: true });
  return NextResponse.json(result);
}
