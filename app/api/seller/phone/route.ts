import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { upsertPhoneOtp, countRecentOtpRequests } from "@/lib/db";
import { sendSmsOtp } from "@/lib/sms";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().min(9).max(15).regex(/^[+\d\s()\-]+$/, "Invalid phone format"),
});

function otp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Normalise any Kenyan format → +254XXXXXXXXX (E.164) for storage */
function normalizePhone(phone: string): string {
  let p = phone.replaceAll(/[\s\-().]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  return `+${p}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // ── Rate limit: max 3 OTP requests per user per hour ──────────────────────
  try {
    const recentCount = await countRecentOtpRequests(session.user.id);
    if (recentCount >= 3) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait an hour before requesting another code." },
        { status: 429 },
      );
    }
  } catch (err) {
    // DB rate-limit check failed — fail open so SMS still works
    console.warn("[seller/phone] rate-limit check failed:", err);
  }

  const phone = normalizePhone(parsed.data.phone);
  const code  = otp6();

  try {
    await upsertPhoneOtp(session.user.id, phone, code);
    await sendSmsOtp(phone, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[seller/phone POST]", err);
    const detail = err instanceof Error ? err.message : String(err);
    // Surface the real AT error in development; keep generic in production
    const message = process.env.NODE_ENV === "development"
      ? `SMS error: ${detail}`
      : "Failed to send SMS. Check your number and try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
