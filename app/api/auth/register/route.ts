import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail, createUser, isDbConfigured } from "@/lib/db";
import { findLocalUser, createLocalUser } from "@/lib/local-users";
import { Resend } from "resend";

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
      return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
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

    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
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
      return NextResponse.json({ error: "Database not initialised" }, { status: 500 });
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
