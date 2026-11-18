import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";
import { emailSchema, normalizeEmail, emailEquals } from "../lib/email-normalize.ts";

// Regression tests for a reported bug: entering an email address that was
// already registered sometimes reported "Invalid email".
//
// ROOT CAUSE: every email field validated with z.string().email() BEFORE
// normalising. zod's .email() rejects any leading or trailing whitespace, so
// " user@email.com " failed as a format error and the duplicate-account check
// was never reached. Pasting an address from a password manager or a mail
// client routinely carries a trailing space or newline, which is why it
// looked intermittent rather than consistent.

const PADDED = [
  " user@email.com",
  "user@email.com ",
  "  user@email.com  ",
  "user@email.com\n",
  "user@email.com\r\n",
  "\tuser@email.com",
  "  User@Email.COM  ",
];

test("the old validator rejected padded addresses - the bug being fixed", async () => {
  // Pins the cause so the regression is unmistakable if anyone reverts to the
  // bare check. This asserts zod's behaviour, which is what the code relied on.
  const { z } = await import("zod");
  const bare = z.string().email();
  for (const input of PADDED) {
    assert.equal(
      bare.safeParse(input).success,
      false,
      `${JSON.stringify(input)} would have passed - the premise of this fix is wrong`,
    );
  }
});

test("a padded but valid address now passes and is normalised", () => {
  const schema = emailSchema();
  for (const input of PADDED) {
    const r = schema.safeParse(input);
    assert.equal(r.success, true, `${JSON.stringify(input)} must be accepted`);
    assert.equal(r.data, "user@email.com", `${JSON.stringify(input)} must normalise`);
  }
});

test("a genuinely malformed address is still refused, with the agreed wording", () => {
  const schema = emailSchema();
  for (const input of ["notanemail", "a@b", "@email.com", "user@", "", "   ", "user @email.com"]) {
    const r = schema.safeParse(input);
    assert.equal(r.success, false, `${JSON.stringify(input)} must be refused`);
    assert.equal(r.error.issues[0].message, "Please enter a valid email address.");
  }
});

test("the normalised value is what reaches the database", () => {
  // The duplicate check and the insert must see the same string, or a padded
  // address creates a second row for an account that already exists.
  const r = emailSchema().safeParse("  User@Email.COM  ");
  assert.ok(r.success);
  assert.equal(r.data, normalizeEmail("User@Email.com"));
  assert.ok(emailEquals(r.data, "user@email.com"));
});

test("every email field in the auth paths uses the shared schema", () => {
  // Client and server must agree on what a valid address is. When they
  // disagree, one of them refuses input the other would have accepted, and
  // the user is told their real address is invalid.
  const files = [
    "app/register/page.tsx",
    "app/login/page.tsx",
    "auth.ts",
    ...globSync("app/api/auth/**/route.ts").map((f) => f.replaceAll("\\", "/")),
  ];

  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (/z\s*\.\s*string\s*\(\s*\)\s*\.\s*email\s*\(/.test(src)) offenders.push(f);
  }

  assert.deepEqual(
    offenders,
    [],
    "these validate before normalising, which is the bug:\n  " + offenders.join("\n  "),
  );
});

test("the registration route reports a format error only for the email field", () => {
  // "Invalid input" for every failure is what let a valid-but-padded address
  // read as a format problem.
  const src = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.ok(
    !/return NextResponse\.json\(\{ error: "Invalid input" \}/.test(src),
    "the blanket 'Invalid input' response is back",
  );
  assert.match(src, /Please enter a valid email address\./);
});

test("an existing verified account is told to log in, not that the email is invalid", () => {
  const src = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.match(src, /This email address is already registered\. Please log in\./);
  assert.match(src, /code: "email_in_use"/);
});

test("an existing unverified account gets verification advice", () => {
  // getUserAuthMethods always returned emailVerified; the branch was unused,
  // so an unverified user was told to log in - which sign-in then refuses.
  const src = readFileSync("app/api/auth/register/route.ts", "utf8");
  assert.match(src, /methods\.hasPassword && !methods\.emailVerified/);
  assert.match(src, /hasn't been verified yet/);
  assert.match(src, /code: "email_unverified"/);
});

test("the register form survives a network failure without blaming the email", () => {
  const src = readFileSync("app/register/page.tsx", "utf8");
  assert.match(src, /We couldn't reach the server/, "a fetch rejection must be reported");
  assert.match(src, /res\.json\(\)\.catch/, "a non-JSON error body must not throw");
  assert.ok(
    !/setServerError\(json\.error \?\? "Registration failed"\)/.test(src),
    "the old catch-all is back",
  );
});

test("recovery routes stay generic and do not confirm whether an account exists", async () => {
  // Registration necessarily reveals existence. Password reset and
  // resend-verification must not, so fixing the message quality above must
  // not leak enumeration here.
  const forgot = readFileSync("app/api/auth/forgot-password/route.ts", "utf8");
  assert.match(forgot, /If an account exists for that email/);
  assert.ok(
    !/Email not found|No account/i.test(forgot),
    "forgot-password must not confirm whether the address is registered",
  );

  const resend = readFileSync("app/api/auth/resend-verification/route.ts", "utf8");
  assert.match(resend, /Don't reveal whether the email exists|ok: true/);
});

// ---- behavioural: the route itself ----

let instance = 0;

/**
 * Mocks lib/db for the registration route.
 *
 * Mocking a module replaces it for EVERY importer, not just the one under
 * test, so a hand-written stub must also satisfy the route's transitive
 * dependencies (lib/realtime wants `query`, the analytics helper wants
 * `insertAnalyticsEvent`, and so on). Enumerating those is a losing game and
 * couples this test to an unrelated import graph.
 *
 * So the real module is spread and only the three functions under test are
 * overridden. Importing lib/db is safe without a database: the pool is built
 * lazily on first query, and nothing here issues one.
 *
 * Registered through the test context so it is restored automatically - a
 * failure that skipped mock.reset() would otherwise leave the module mocked
 * and every later test would fail with "already mocked".
 */
async function mockDb(
  t: { mock: { module: (u: string, o: unknown) => void } },
  methods: unknown,
  onLookup?: (e: string) => void,
) {
  const real = await import("../lib/db.ts");
  t.mock.module(new URL("../lib/db.ts", import.meta.url).href, {
    namedExports: {
      ...real,
      isDbConfigured: () => true,
      getUserAuthMethods: async (email: string) => { onLookup?.(email); return methods; },
      createUser: async () => { throw new Error("must not create a user for an existing address"); },
      setVerificationCode: async () => {},
      markUserEmailVerified: async () => {},
    },
  });
}

test("the registration route accepts a padded email and reaches the duplicate check", async (t) => {
  // The end-to-end point of the fix: a padded address that belongs to an
  // existing account must produce the duplicate answer, not a format error.
  const asked: string[] = [];
  await mockDb(t, { exists: true, hasPassword: true, hasGoogle: false, provider: "email", emailVerified: true, isActive: true },
        (e) => asked.push(e));

  const { POST } = await import(`../app/api/auth/register/route.ts?case=${++instance}`);
  const res = await POST(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A Person", email: "  User@Email.COM  ", password: "longenough1" }),
  }));

  assert.equal(res.status, 409, "a padded, already-registered email must not be a 400 format error");
  const body = await res.json();
  assert.equal(body.code, "email_in_use");
  assert.match(body.error, /already registered\. Please log in\./);
  assert.deepEqual(asked, ["user@email.com"], "the lookup must receive the normalised address");
});

test("the registration route distinguishes an unverified existing account", async (t) => {
  await mockDb(t, { exists: true, hasPassword: true, hasGoogle: false, provider: "email", emailVerified: false, isActive: true });

  const { POST } = await import(`../app/api/auth/register/route.ts?case=${++instance}`);
  const res = await POST(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A Person", email: "pending@email.com", password: "longenough1" }),
  }));

  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "email_unverified");
});

test("a genuinely malformed email is a 400 naming the email field", async (t) => {
  await mockDb(t, { exists: false, hasPassword: false, hasGoogle: false, provider: "", emailVerified: false, isActive: false });

  const { POST } = await import(`../app/api/auth/register/route.ts?case=${++instance}`);
  const res = await POST(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "A Person", email: "notanemail", password: "longenough1" }),
  }));

  assert.equal(res.status, 400, "a malformed address must still be a format error");
  const body = await res.json();
  assert.equal(body.field, "email");
  assert.equal(body.error, "Please enter a valid email address.");
});
