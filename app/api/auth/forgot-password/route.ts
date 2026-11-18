import { NextResponse } from "next/server";
import { z } from "zod";
import { isDbConfigured, setResetCode, getUserAuthMethods } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { emailSchema, normalizeEmail } from "@/lib/email-normalize";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/auth-audit";

export const runtime = "nodejs";

const schema = z.object({ email: emailSchema() });

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
  if (!rl.ok) {
    // Previously this returned GENERIC - "a reset code has been sent" - while
    // sending nothing. The user then waited for an email that was never
    // coming and concluded the older code had expired.
    //
    // This reply is identical whether or not the account exists, so it still
    // reveals nothing: the limiter is keyed on the submitted address, not on
    // whether it matches a user.
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please wait a minute before requesting another code." },
      { status: 429 },
    );
  }

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
    // Was sendVerificationEmail(email, "Reset code", code) - which both sent
    // the verification wording AND rendered "Hi Reset code," as the greeting,
    // because the second argument is the recipient's name.
    sendPasswordResetEmail(email, "there", code).catch((err) => {
      console.warn("[forgot-password] email send failed:", err instanceof Error ? err.message : err);
    });

    recordAuthEvent("auth_password_set", { email, stage: "code_sent" });
  } catch (err) {
    console.error("[forgot-password]", err instanceof Error ? err.message : err);
  }
  return GENERIC;
}
