import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listUsers, updateUserRole } from "@/lib/db";

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

  const { id, role } = await req.json() as { id?: string; role?: string };
  const validRoles = ["buyer", "dealer", "admin"];

  if (!id || !role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Prevent the current admin from downgrading their own account.
  if (id === session.user.id && role !== "admin") {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  await updateUserRole(id, role);
  return NextResponse.json({ ok: true });
}
