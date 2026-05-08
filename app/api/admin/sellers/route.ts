import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listSellerVerifications,
  getSellerVerificationCounts,
  reviewSellerVerification,
} from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session;
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const [sellers, counts] = await Promise.all([
    listSellerVerifications(status),
    getSellerVerificationCounts(),
  ]);
  return NextResponse.json({ sellers, counts });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status, adminNotes } = await req.json() as {
    id: string;
    status: "approved" | "rejected";
    adminNotes?: string;
  };

  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await reviewSellerVerification(id, status, session.user.id, adminNotes);
  return NextResponse.json({ ok: true });
}
