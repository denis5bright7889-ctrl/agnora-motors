import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handlers.GET(req);
}

export function POST(req: NextRequest) {
  return handlers.POST(req);
}
