import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isDbConfigured, consumeResetCode } from "@/lib/db";
import { emailSchema, normalizeEmail } from "@/lib/email-normalize";
import { otpSchema } from "@/lib/otp-code";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/auth-audit";

export const runtime = "nodejs";

const schema = z.object({
  email:    emailSchema(),
  code:     otpSchema(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid input" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Name the field that is wrong. A blanket "Invalid input" is what made a
    // pasted code carrying a newline look like an expired code.
    const field = parsed.error.issues[0]?.path?.[0];
    const error =
      field === "code"
        ? "Enter the 6-digit code from your email."
        : field === "password"
          ? "Your new password must be at least 8 characters."
          : field === "email"
            ? "Please enter a valid email address."
            : "Please check the details you entered.";
    return NextResponse.json({ error, code: "invalid_input", field }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);

  // 10 attempts per email per minute — slow but not blocking legitimate users.
  const rl = checkRateLimit(`reset-verify:${email}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const ok = await consumeResetCode(email, parsed.data.code, passwordHash);
    if (!ok) {
      recordAuthEvent("auth_password_set", { email, stage: "code_invalid" });
      // One message for every failure, on purpose. Separating "already used"
      // from "expired" would mean reporting reset state to anyone who can
      // post to this endpoint, and distinguishing them server-side would
      // require retaining a consumed code to compare against — more secret
      // state, for a worse outcome. The wording instead covers both cases and
      // points forward, which is what the user actually needs.
      return NextResponse.json(
        {
          error:
            "That code is no longer valid — it may have expired or already been used. " +
            "If you have already set a new password, try signing in. Otherwise request a new code.",
          code: "code_not_valid",
        },
        { status: 400 },
      );
    }
    recordAuthEvent("auth_password_set", { email, stage: "completed" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
