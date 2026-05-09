import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail, setVerificationCode, isDbConfigured } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true });
    }

    const user = await getUserByEmail(parsed.data.email);
    if (!user) {
      // Don't reveal whether the email exists
      return NextResponse.json({ ok: true });
    }

    const code = randomCode();
    await setVerificationCode(parsed.data.email, code);
    console.log("[resend-verification] OTP saved for email=%s", parsed.data.email);

    await sendVerificationEmail(parsed.data.email, user.name ?? "there", code);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification] failed:", err);
    return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
  }
}
