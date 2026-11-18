import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeOtp, isValidOtp, otpSchema } from "../lib/otp-code.ts";

// Regression tests for five password-reset defects, reported after a real
// reset attempt that kept answering "code expired" for a code that was
// neither expired nor wrong.

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ---------------- 1. code normalised before validation ----------------

test("the old validator rejected a pasted code - the bug being fixed", async () => {
  // Pins the cause. Copying a code out of a mail client routinely brings a
  // trailing space or newline, and z.string().length(6) refuses it, so the
  // request died as "Invalid input" before any lookup ran.
  const { z } = await import("zod");
  const bare = z.string().length(6);
  for (const input of ["123456 ", " 123456", "123456\n", "123 456"]) {
    assert.equal(
      bare.safeParse(input).success,
      false,
      `${JSON.stringify(input)} would have passed - the premise of this fix is wrong`,
    );
  }
});

test("a pasted code survives whitespace and separators", () => {
  const schema = otpSchema();
  for (const input of [
    "123456",
    " 123456",
    "123456 ",
    "  123456  ",
    "123456\n",
    "123456\r\n",
    "\t123456",
    "123 456",       // read aloud, retyped with a space
    "123-456",       // hyphenated
    "1 2 3 4 5 6",
  ]) {
    const r = schema.safeParse(input);
    assert.equal(r.success, true, `${JSON.stringify(input)} must be accepted`);
    assert.equal(r.data, "123456", `${JSON.stringify(input)} must normalise`);
  }
});

test("the six-digit requirement is not weakened", () => {
  const schema = otpSchema();
  for (const bad of [
    "12345",      // too short
    "1234567",    // too long
    "12a456",     // letter
    "12.456",     // punctuation that is not a separator
    "",
    "      ",
    "abcdef",
    "12345 ",  // non-breaking space leaves 5 digits
  ]) {
    assert.equal(schema.safeParse(bad).success, false, `${JSON.stringify(bad)} must be refused`);
  }
  assert.equal(isValidOtp("123456"), true);
  assert.equal(isValidOtp("12345"), false);
  assert.equal(normalizeOtp(null), "");
});

test("the reset and verify routes both normalise before validating", () => {
  for (const path of [
    "app/api/auth/reset-password/route.ts",
    "app/api/auth/verify-email/route.ts",
  ]) {
    const src = code(path);
    assert.match(src, /otpSchema\(\)/, `${path} must use the shared code schema`);
    assert.ok(
      !/z\.string\(\)\.length\(6\)/.test(src),
      `${path} still validates the raw code before normalising`,
    );
  }
});

test("a bad code is reported as a code problem, not as generic invalid input", () => {
  const src = code("app/api/auth/reset-password/route.ts");
  assert.match(src, /Enter the 6-digit code from your email\./);
  assert.ok(
    !/return NextResponse\.json\(\{ error: "Invalid input" \}, \{ status: 400 \}\);\s*\}\s*const email/.test(src),
    "the blanket 'Invalid input' response for a parse failure is back",
  );
});

// ---------------- 2 & 3. single-use semantics ----------------

test("consuming a reset code is a single atomic statement", () => {
  // It used to SELECT the row then UPDATE it. Between the two, a
  // double-clicked form or two parallel requests could both pass the SELECT
  // and both write a password - the second silently winning.
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function consumeResetCode"));
  const body = fn.slice(0, fn.indexOf("\n}"));

  const statements = (body.match(/\b(SELECT|UPDATE|INSERT|DELETE)\b/g) ?? [])
    .filter((kw) => kw !== "SELECT" || false);
  assert.equal(
    (body.match(/\bUPDATE users\b/g) ?? []).length,
    1,
    "expected exactly one UPDATE",
  );
  assert.ok(
    !/SELECT id, provider FROM users/.test(body),
    "the read-then-write pattern is back; a double submit can reset twice",
  );
  assert.match(body, /RETURNING id/, "the write must report whether it matched");
  assert.ok(statements.length >= 0); // keeps the linter honest about the filter above
});

test("the consuming statement matches only an unused, unexpired code", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function consumeResetCode"));
  const body = fn.slice(0, fn.indexOf("\n}"));

  assert.match(body, /WHERE email = \$1/);
  assert.match(body, /AND reset_code = \$2/, "a wrong code must not match");
  assert.match(body, /AND reset_code_expires_at > NOW\(\)/, "an expired code must not match");
  assert.match(body, /reset_code = NULL/, "a successful reset must consume the code");
  // Because the same statement nulls the code, a second identical submission
  // matches zero rows and returns false. That IS the single-use guarantee.
});

test("setting a password keeps an existing Google provider", () => {
  // A Google user who sets a password must end up able to use either method.
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function consumeResetCode"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /provider \|\| ',email'/, "email must be appended, not replace the provider");
  assert.match(body, /WHEN provider = 'email' OR provider LIKE/, "and must not be appended twice");
});

test("a failed reset says one thing, and never reports account state", () => {
  const src = code("app/api/auth/reset-password/route.ts");
  assert.match(src, /may have expired or already been used/);
  assert.match(src, /try signing in/, "the message must point forward");
  // Must NOT branch on server state in a way that reveals it.
  assert.ok(
    !/already[_ ]used["']?\s*[,:)]/i.test(src.replace(/may have expired or already been used/g, "")),
    "a distinct already-used response would report reset state to anyone who can post here",
  );
});

// ---------------- 4. distinct email templates ----------------

test("reset and verification emails are visibly different", () => {
  const src = readFileSync("lib/email.ts", "utf8");
  assert.match(src, /subject: "Your Agnora verification code"/);
  assert.match(src, /subject: "Reset your Agnora Motors password"/);
  assert.match(src, /Password reset code/, "the reset email needs its own heading");
  assert.match(src, /sendPasswordResetEmail/, "the reset path needs its own sender");
});

test("each email states the correct expiry for its own code", () => {
  // The template said 15 minutes for both; setResetCode grants 30.
  const src = readFileSync("lib/email.ts", "utf8");
  assert.match(src, /expiry: "15 minutes"/, "verification codes last 15 minutes");
  assert.match(src, /expiry: "30 minutes"/, "reset codes last 30 minutes");

  const db = readFileSync("lib/db.ts", "utf8");
  assert.match(db, /reset_code_expires_at = NOW\(\) \+ INTERVAL '30 minutes'/);
  assert.match(db, /verification_expires_at = NOW\(\) \+ INTERVAL '15 minutes'/);
});

test("the reset email no longer greets the user as 'Reset code'", () => {
  // forgot-password called sendVerificationEmail(email, "Reset code", code),
  // and the second argument is the recipient's NAME.
  const src = code("app/api/auth/forgot-password/route.ts");
  assert.ok(
    !/sendVerificationEmail\(email, "Reset code"/.test(src),
    "the recipient name is still being passed the string 'Reset code'",
  );
  assert.match(src, /sendPasswordResetEmail\(/);
});

// ---------------- 5. truthful rate limiting ----------------

test("a rate-limited request does not claim an email was sent", () => {
  const src = code("app/api/auth/forgot-password/route.ts");
  const limitBlock = src.slice(src.indexOf("const rl = checkRateLimit("), src.indexOf("if (!isDbConfigured())"));

  assert.ok(
    !/return GENERIC/.test(limitBlock),
    "the limiter still answers 'a reset code has been sent' without sending one",
  );
  assert.match(limitBlock, /Too many requests/);
  assert.match(limitBlock, /status: 429/);
});

test("the rate-limited reply still reveals nothing about the account", () => {
  // The limiter is keyed on the submitted address, not on whether it matches
  // a user, so the same reply comes back either way.
  const raw = readFileSync("app/api/auth/forgot-password/route.ts", "utf8");
  assert.match(raw, /checkRateLimit\(`reset:\$\{email\}`/);
  // Comments are stripped first: the code explains WHY the reply is safe, and
  // that explanation naturally contains the very words being banned from it.
  const src = code("app/api/auth/forgot-password/route.ts");
  const limitBlock = src.slice(src.indexOf("if (!rl.ok)"), src.indexOf("if (!isDbConfigured())"));
  for (const leak of ["exists", "not found", "no account", "unknown email"]) {
    assert.ok(!limitBlock.toLowerCase().includes(leak), `rate-limit reply mentions "${leak}"`);
  }
});

test("the generic response is still used for every non-rate-limited outcome", () => {
  // Narrowing the limiter must not have removed enumeration protection
  // elsewhere in the route.
  const src = code("app/api/auth/forgot-password/route.ts");
  assert.match(src, /If an account exists for that email/);
  assert.ok(
    (src.match(/return GENERIC/g) ?? []).length >= 3,
    "the generic reply must still cover bad input, unknown account and success",
  );
});
