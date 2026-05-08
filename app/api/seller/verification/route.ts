import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getOrCreateSellerVerification,
  patchSellerVerification,
  submitSellerVerification,
} from "@/lib/db";

export const runtime = "nodejs";

/** GET — load current verification record (creates one if missing) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const v = await getOrCreateSellerVerification(session.user.id);
    return NextResponse.json({ verification: v });
  } catch (err) {
    console.error("[seller/verification GET]", err);
    return NextResponse.json({ error: "Failed to load verification status" }, { status: 500 });
  }
}

/** PATCH — save document URLs after upload */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const body = await req.json() as Record<string, string>;
    const allowed = new Set(["idDocUrl", "kraCertUrl", "logbookUrl", "selfieUrl", "businessCertUrl"]);
    const safe = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.has(k)),
    );
    await patchSellerVerification(session.user.id, safe);
    const updated = await getOrCreateSellerVerification(session.user.id);
    return NextResponse.json({ verification: updated });
  } catch (err) {
    console.error("[seller/verification PATCH]", err);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }
}

/** POST — submit application for admin review */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const v = await getOrCreateSellerVerification(session.user.id);
    if (!v.phoneVerified) {
      return NextResponse.json({ error: "Verify your phone number first." }, { status: 400 });
    }
    if (!v.idDocUrl || !v.kraCertUrl || !v.logbookUrl || !v.selfieUrl) {
      return NextResponse.json(
        { error: "Upload all required documents before submitting." },
        { status: 400 },
      );
    }
    if (v.status !== "pending") {
      return NextResponse.json({ error: "Application already submitted." }, { status: 409 });
    }
    await submitSellerVerification(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[seller/verification POST]", err);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
