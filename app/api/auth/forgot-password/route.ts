import { NextResponse } from "next/server";
import { z } from "zod";
import { isDbConfigured, setResetCode, getUserAuthMethods } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/email-normalize";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/auth-audit";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

// Generic response shared regardless of whether the email exists. Prevents
// account enumeration through this endpoint.
const GENERIC = NextResponse.json({
  ok: true,
  message: "If an account exists for that email, a reset code has been sent.",
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return GENERIC; // bad input → same generic response

  const email = normalizeEmail(parsed.data.email);

  // Rate limit by email so a single attacker can't blast codes to one inbox.
  const rl = checkRateLimit(`reset:${email}`, 3, 60_000);
  if (!rl.ok) return GENERIC;

  if (!isDbConfigured()) return GENERIC;

  try {
    const methods = await getUserAuthMethods(email);
    if (!methods.exists) {
      // Don't leak. Still return GENERIC.
      recordAuthEvent("auth_login_failed", { email, reason: "reset_no_user" });
      return GENERIC;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await setResetCode(email, code);

    // Best-effort email — failure does NOT change response (still GENERIC).
    sendVerificationEmail(email, "Reset code", code).catch((err) => {
      console.warn("[forgot-password] email send failed:", err instanceof Error ? err.message : err);
    });

    recordAuthEvent("auth_password_set", { email, stage: "code_sent" });
  } catch (err) {
    console.error("[forgot-password]", err instanceof Error ? err.message : err);
  }
  return GENERIC;
}
