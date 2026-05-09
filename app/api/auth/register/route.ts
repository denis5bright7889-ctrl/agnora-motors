import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail, createUser, setVerificationCode, markUserEmailVerified, isDbConfigured } from "@/lib/db";
import { findLocalUser, createLocalUser } from "@/lib/local-users";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["buyer", "dealer"]).optional().default("buyer"),
});

type Input = z.infer<typeof schema>;

// ── Local (no-DB) path ────────────────────────────────────────────────────────

function registerLocal(data: Input) {
  if (findLocalUser(data.email)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  bcrypt.hash(data.password, 12).then((passwordHash) => {
    createLocalUser({ email: data.email, name: data.name, passwordHash, role: "buyer" });
  }).catch(() => {/* non-fatal — local store only */});
  return NextResponse.json({ verified: true }, { status: 201 });
}

// ── Dealer path ───────────────────────────────────────────────────────────────

async function registerDealer(data: Input) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await createUser({ email: data.email, name: data.name, passwordHash, role: "dealer" });
  await markUserEmailVerified(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email }, verified: true }, { status: 201 });
}

// ── Buyer path ────────────────────────────────────────────────────────────────

async function registerBuyer(data: Input) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await createUser({ email: data.email, name: data.name, passwordHash, role: "buyer" });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await setVerificationCode(data.email, code);
  console.log("[register] OTP saved for email=%s", data.email);

  try {
    await sendVerificationEmail(data.email, data.name, code);
  } catch (emailErr) {
    console.error("[register] email delivery failed for email=%s:", data.email, emailErr);
    return NextResponse.json(
      { user: { id: user.id, email: user.email }, verificationSent: false, verified: false,
        error: "Account created but verification email could not be sent. Please use 'Resend code' on the next page." },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { user: { id: user.id, email: user.email }, verificationSent: true, verified: false },
    { status: 201 },
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const data = parsed.data;

    if (!isDbConfigured()) return registerLocal(data);

    const existing = await getUserByEmail(data.email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    return data.role === "dealer" ? registerDealer(data) : registerBuyer(data);

  } catch (err) {
    const e = err as { code?: string; message?: string; stack?: string };
    console.error("[register] error code=%s message=%s", e.code ?? "n/a", e.message ?? String(err));

    if (e.code === "23505") return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    if (e.code === "42P01") return NextResponse.json({ error: "Database not initialized. Run db/schema.sql." }, { status: 500 });
    if (e.code === "42703") return NextResponse.json({ error: "Database schema is out of date. Re-run db/schema.sql." }, { status: 500 });
    if (e.message?.includes("ECONNREFUSED") || e.message?.includes("connect")) {
      return NextResponse.json({ error: "Database connection failed. Check DATABASE_URL." }, { status: 500 });
    }

    const detail = process.env.NODE_ENV === "development" ? (e.message ?? String(err)) : "Registration failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
