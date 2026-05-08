import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyPhoneOtp, getOrCreateSellerVerification, patchSellerVerification } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  code:  z.string().length(6).regex(/^\d{6}$/),
  phone: z.string().min(9).max(15),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const result = await verifyPhoneOtp(session.user.id, parsed.data.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await getOrCreateSellerVerification(session.user.id);
    await patchSellerVerification(session.user.id, {
      phone:         parsed.data.phone,
      phoneVerified: true,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[seller/phone/verify POST]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
