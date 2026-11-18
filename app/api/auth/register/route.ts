import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  getUserAuthMethods, createUser, setVerificationCode, markUserEmailVerified, isDbConfigured,
} from "@/lib/db";
import { findLocalUser, createLocalUser } from "@/lib/local-users";
import { sendVerificationEmail } from "@/lib/email";
import { publishEvent } from "@/lib/realtime";
import { emailSchema, normalizeEmail } from "@/lib/email-normalize";
import { recordAuthEvent } from "@/lib/auth-audit";

export const runtime = "nodejs";

const schema = z.object({
  name:     z.string().min(2),
  email:    emailSchema(),
  password: z.string().min(8),
  role:     z.enum(["buyer", "dealer"]).optional().default("buyer"),
});

type Input = z.infer<typeof schema>;

// ── Local (no-DB) path ────────────────────────────────────────────────────────

function registerLocal(data: Input) {
  if (findLocalUser(data.email)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  bcrypt.hash(data.password, 12).then((passwordHash) => {
    createLocalUser({ email: data.email, name: data.name, passwordHash, role: "buyer" });
  }).catch(() => { /* non-fatal — local store only */ });
  return NextResponse.json({ verified: true }, { status: 201 });
}

// ── Dealer path ───────────────────────────────────────────────────────────────

async function registerDealer(data: Input) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await createUser({
    email: data.email, name: data.name, passwordHash,
    role: "dealer", provider: "email",
  });
  await markUserEmailVerified(user.id);
  recordAuthEvent("auth_register", { userId: user.id, email: data.email, provider: "email", role: "dealer" });
  publishEvent("user_registered", { email: data.email, role: "dealer" }).catch(() => {});
  return NextResponse.json({ user: { id: user.id, email: user.email }, verified: true }, { status: 201 });
}

// ── Buyer path ────────────────────────────────────────────────────────────────

async function registerBuyer(data: Input) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await createUser({
    email: data.email, name: data.name, passwordHash,
    role: "buyer", provider: "email",
  });

  // Auto-verify so credentials login works immediately — kept from the
  // previous flow; the email pipeline isn't reliable enough to gate sign-in
  // on verification yet. Audit so we can revisit when reliability is there.
  await markUserEmailVerified(user.id);

  // Best-effort welcome email (with an OTP they don't actually need).
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await setVerificationCode(data.email, code);
    await sendVerificationEmail(data.email, data.name, code);
  } catch (emailErr) {
    console.warn("[register] welcome email failed for %s (non-blocking): %s",
      data.email, emailErr instanceof Error ? emailErr.message : String(emailErr));
  }

  recordAuthEvent("auth_register", { userId: user.id, email: data.email, provider: "email", role: "buyer" });
  publishEvent("user_registered", { email: data.email, role: "buyer" }).catch(() => {});

  return NextResponse.json(
    { user: { id: user.id, email: user.email }, verified: true },
    { status: 201 },
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Name the field that is actually wrong. A single "Invalid input" for
      // every failure is what let a whitespace-padded but perfectly valid
      // email read as a format problem, hiding the real answer (the address
      // is already registered) behind a message about validity.
      const issue = parsed.error.issues[0];
      const field = issue?.path?.[0];
      const error =
        field === "email"
          ? "Please enter a valid email address."
          : field === "password"
            ? "Your password must be at least 8 characters."
            : field === "name"
              ? "Please enter your name."
              : "Please check the details you entered.";
      return NextResponse.json({ error, code: "invalid_input", field }, { status: 400 });
    }

    // Email normalisation: every downstream comparison + insert uses the
    // canonical form. The DB CHECK constraint backs this up.
    const data: Input = { ...parsed.data, email: normalizeEmail(parsed.data.email) };

    if (!isDbConfigured()) return registerLocal(data);

    // Provider-aware existence check. If the email belongs to a Google-only
    // account, redirect the user to "use Google or reset your password"
    // instead of generic 409 — they likely don't realise the account exists.
    const methods = await getUserAuthMethods(data.email);
    if (methods.exists) {
      // An account that exists but has never been verified needs different
      // advice from one that is ready to use: telling someone to "please log
      // in" when sign-in will refuse them for an unverified email sends them
      // in a circle. getUserAuthMethods already reports this; the branch was
      // simply never used.
      if (methods.hasPassword && !methods.emailVerified) {
        return NextResponse.json(
          {
            error:
              "This email address is already registered, but it hasn't been verified yet. " +
              "Check your inbox for the verification code, or request a new one.",
            code: "email_unverified",
          },
          { status: 409 },
        );
      }

      if (methods.hasPassword) {
        return NextResponse.json(
          {
            error: "This email address is already registered. Please log in.",
            code: "email_in_use",
          },
          { status: 409 },
        );
      }
      // Account exists but only has Google.
      return NextResponse.json(
        {
          error: "This account uses Google sign-in. Continue with Google, or use \"Forgot password\" to set a password.",
          code:  "use_google",
        },
        { status: 409 },
      );
    }

    return data.role === "dealer" ? registerDealer(data) : registerBuyer(data);

  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[register] error code=%s message=%s", e.code ?? "n/a", e.message ?? String(err));

    if (e.code === "23505") return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    if (e.code === "23514") return NextResponse.json({ error: "Email format invalid (must be lowercase)" }, { status: 400 });
    if (e.code === "42P01") return NextResponse.json({ error: "Database not initialized. Run db/schema.sql." }, { status: 500 });
    if (e.code === "42703") return NextResponse.json({ error: "Database schema is out of date. Re-run db/schema.sql." }, { status: 500 });
    if (e.message?.includes("ECONNREFUSED") || e.message?.includes("connect")) {
      return NextResponse.json({ error: "Database connection failed. Check DATABASE_URL." }, { status: 500 });
    }

    const detail = process.env.NODE_ENV === "development" ? (e.message ?? String(err)) : "Registration failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
