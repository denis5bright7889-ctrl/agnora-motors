import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDealers, updateDealerStatus } from "@/lib/db";
import { auditLog } from "@/lib/admin-logger";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

export async function GET(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const dealers = await listDealers(status);
  return NextResponse.json({ dealers });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, rejectionReason } = await req.json() as {
    id: string;
    status: "approved" | "rejected";
    rejectionReason?: string;
  };

  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await updateDealerStatus(id, status, rejectionReason);

  await auditLog({
    action:     status === "approved" ? "dealer_approve" : "dealer_reject",
    targetType: "dealer",
    targetId:   id,
    details:    rejectionReason ? { rejectionReason } : {},
  });

  return NextResponse.json({ ok: true });
}
