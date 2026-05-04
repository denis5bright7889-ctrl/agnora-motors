import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPrivateSellerByUserId,
  createPrivateSeller,
  getSubscription,
  isDbConfigured,
} from "@/lib/db";
import { updateUserRole } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const existing = await getPrivateSellerByUserId(session.user.id);
  if (existing) {
    return NextResponse.json({ error: "Already registered as a private seller" }, { status: 409 });
  }

  const { phone, location } = await req.json() as { phone?: string; location?: string };
  if (!phone?.trim() || !location?.trim()) {
    return NextResponse.json({ error: "Phone and location are required" }, { status: 400 });
  }

  await createPrivateSeller({ userId: session.user.id, phone: phone.trim(), location: location.trim() });
  await updateUserRole(session.user.id, "private_seller");

  // Ensure they have a free subscription record
  await getSubscription(session.user.id);

  return NextResponse.json({ ok: true });
}
