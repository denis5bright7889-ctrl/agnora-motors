import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { upsertPhoneOtp } from "@/lib/db";
import { sendSmsOtp } from "@/lib/sms";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().min(9).max(15).regex(/^[+\d\s()-]+$/, "Invalid phone format"),
});

function otp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    const code = otp6();
    await upsertPhoneOtp(session.user.id, parsed.data.phone, code);
    await sendSmsOtp(parsed.data.phone, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[seller/phone POST]", err);
    return NextResponse.json(
      { error: "Failed to send SMS. Check your number and try again." },
      { status: 500 },
    );
  }
}
