import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isDbConfigured, consumeResetCode } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-normalize";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/auth-audit";

export const runtime = "nodejs";

const schema = z.object({
  email:    z.string().email(),
  code:     z.string().length(6),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid input" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    recordAuthEvent("auth_password_set", { email, stage: "completed" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
