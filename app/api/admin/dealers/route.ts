import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDealers, updateDealerStatus, setDealerSuspension } from "@/lib/db";
import { auditLog, type AdminAction } from "@/lib/admin-logger";

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

// Two mutation modes, distinguished by which fields the body sets:
//   - { id, status: 'approved'|'rejected', rejectionReason? } — application
//     review flow (unchanged).
//   - { id, isActive: boolean, reason? } — PR2 manual suspend/unsuspend.
//     Sets dealers.is_active and stamps dealers.suspended_at / suspension_reason;
//     unsuspending clears the rolling strike counter so the next strike doesn't
//     re-suspend immediately.
export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    id?: string;
    status?: "approved" | "rejected";
    rejectionReason?: string;
    isActive?: boolean;
    reason?: string;
  };
  const { id, status, rejectionReason, isActive, reason } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // ── Application review (existing flow) ─────────────────────────
  if (status !== undefined) {
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await updateDealerStatus(id, status, rejectionReason);
    await auditLog({
      action:     status === "approved" ? "dealer_approve" : "dealer_reject",
      targetType: "dealer",
      targetId:   id,
      details:    rejectionReason ? { rejectionReason } : {},
    });
  }

  // ── Suspension toggle (PR2) ────────────────────────────────────
  if (isActive !== undefined) {
    const trimmedReason = reason?.trim() || null;
    await setDealerSuspension(id, isActive, trimmedReason);
    const action: AdminAction = isActive ? "dealer_unsuspend" : "dealer_suspend";
    await auditLog({
      action,
      targetType: "dealer",
      targetId:   id,
      details:    { isActive, reason: trimmedReason },
    });
  }

  return NextResponse.json({ ok: true });
}
