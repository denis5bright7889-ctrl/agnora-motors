import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail, createUser, setVerificationCode, isDbConfigured } from "@/lib/db";
import { findLocalUser, createLocalUser } from "@/lib/local-users";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // ── File-based fallback when no DATABASE_URL ──────────────
    if (!isDbConfigured()) {
      const existing = findLocalUser(parsed.data.email);
      if (existing) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const user = createLocalUser({
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: "buyer",
      });
      // Local users skip email verification
      return NextResponse.json({ user: { id: user.id, email: user.email }, verified: true }, { status: 201 });
    }

    // ── Database path ─────────────────────────────────────────
    const existing = await getUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: "buyer",
    });

    // Generate and send 6-digit verification code — non-blocking so a DB schema
    // migration lag or missing RESEND_API_KEY never prevents account creation.
    let verificationSent = false;
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await setVerificationCode(parsed.data.email, code);
      verificationSent = true;
      sendVerificationEmail(parsed.data.email, parsed.data.name, code).catch((e) =>
        console.error("[register] email send failed:", e),
      );
    } catch (verifyErr) {
      console.error("[register] verification setup failed (non-fatal):", verifyErr);
    }

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        verificationSent,
        verified: !verificationSent, // if verification setup failed, allow direct login
      },
      { status: 201 },
    );
  } catch (err) {
    const e = err as { code?: string; message?: string; stack?: string };
    console.error("[register] error code=%s message=%s", e.code ?? "n/a", e.message ?? String(err));
    if (e.stack) console.error("[register] stack:", e.stack);

    // 23505 = unique_violation — race-condition duplicate email
    if (e.code === "23505") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // 42P01 = undefined_table — schema hasn't been applied yet
    if (e.code === "42P01") {
      console.error("[register] The 'users' table does not exist. Run db/schema.sql in the Neon SQL editor.");
      return NextResponse.json({ error: "Database not initialized. Run db/schema.sql." }, { status: 500 });
    }

    // 42703 = undefined_column — missing migration (ALTER TABLE not run)
    if (e.code === "42703") {
      return NextResponse.json({ error: "Database schema is out of date. Re-run db/schema.sql." }, { status: 500 });
    }

    // ECONNREFUSED / connection failures
    if (e.message?.includes("ECONNREFUSED") || e.message?.includes("connect")) {
      return NextResponse.json({ error: "Database connection failed. Check DATABASE_URL." }, { status: 500 });
    }

    const detail = process.env.NODE_ENV === "development"
      ? (e.message ?? String(err))
      : "Registration failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
