import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listUsers, updateUserRole, setUserActive } from "@/lib/db";
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
  };
  const { id, role, isActive } = body;

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
  if (isActive !== undefined) {
    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
    }
    await setUserActive(id, isActive);
    await auditLog({
      action: isActive ? "user_activate" : "user_deactivate",
      targetType: "user", targetId: id,
      details: { isActive },
    });
  }

  return NextResponse.json({ ok: true });
}
