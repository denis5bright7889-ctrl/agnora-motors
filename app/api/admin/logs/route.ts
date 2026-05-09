import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminLogs, getAdminLogCount } from "@/lib/db";

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
  const limit   = Math.min(Number(searchParams.get("limit")  ?? 50), 100);
  const offset  = Number(searchParams.get("offset") ?? 0);
  const action  = searchParams.get("action")  ?? undefined;
  const adminId = searchParams.get("adminId") ?? undefined;

  const [logs, total] = await Promise.all([
    getAdminLogs({ limit, offset, action, adminId }),
    getAdminLogCount({ action, adminId }),
  ]);

  return NextResponse.json({ logs, total, limit, offset });
}
