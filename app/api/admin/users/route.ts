import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listUsers, updateUserRole, setUserActive, setUserSuspension } from "@/lib/db";
import { auditLog } from "@/lib/admin-logger";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    id?: string;
    role?: string;
    isActive?: boolean;
    reason?: string;
  };
  const { id, role, isActive, reason } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // ── Role change ───────────────────────────────────────────────
  if (role !== undefined) {
    const validRoles = ["buyer", "dealer", "private_seller", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (id === session.user.id && role !== "admin") {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    await updateUserRole(id, role);
    await auditLog({
      action: "role_change", targetType: "user", targetId: id,
      details: { newRole: role },
    });
  }

  // ── Active toggle ─────────────────────────────────────────────
  // When the toggle is paired with a reason we treat it as a *suspension*
  // (PR2): stamps suspended_at + suspended_reason so support can answer
  // "when and why?", and clearing the flag resets strike_count so the
  // user isn't instantly re-suspended by the next strike in the window.
  // Without a reason it stays the existing simple active/deactivate toggle.
  if (isActive !== undefined) {
    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
    }
    const trimmedReason = reason?.trim() || null;
    if (trimmedReason || !isActive) {
      await setUserSuspension(id, isActive, trimmedReason);
      await auditLog({
        action: isActive ? "user_unsuspend" : "user_suspend",
        targetType: "user", targetId: id,
        details: { isActive, reason: trimmedReason },
      });
    } else {
      await setUserActive(id, isActive);
      await auditLog({
        action: isActive ? "user_activate" : "user_deactivate",
        targetType: "user", targetId: id,
        details: { isActive },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
