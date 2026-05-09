import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/db";
import { auditLog } from "@/lib/admin-logger";

export const runtime = "nodejs";

const COOKIE = "__agnora_imp";
const MAX_AGE = 60 * 60; // 1 hour

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

// POST /api/admin/impersonate — start impersonating a user
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json() as { userId?: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
  }

  const target = await getUserById(userId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Admins cannot impersonate other admins
  if (target.role === "admin") {
    return NextResponse.json({ error: "Cannot impersonate another admin" }, { status: 403 });
  }

  await auditLog({
    action:     "impersonate_start",
    targetType: "user",
    targetId:   userId,
    details:    { targetEmail: target.email, targetRole: target.role },
  });

  const res = NextResponse.json({
    ok: true,
    target: { id: target.id, email: target.email, name: target.name, role: target.role },
  });

  res.cookies.set(COOKIE, userId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   MAX_AGE,
    sameSite: "strict",
  });

  return res;
}

// DELETE /api/admin/impersonate — stop impersonating
export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Read who was being impersonated for the audit log
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${COOKIE}=([^;]+)`));
  const targetId = match?.[1] ?? "unknown";

  await auditLog({
    action:     "impersonate_end",
    targetType: "user",
    targetId,
    details:    {},
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
