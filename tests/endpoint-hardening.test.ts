import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression tests for two endpoints that were hardened after an audit.
//
// Part of this is behavioural (the handler is invoked with a mocked session)
// and part is a source assertion. The source checks are here deliberately: the
// defects were "this value appears in a response body" and "this secret
// arrives in a query string", which are properties of the code rather than of
// any single response, and a behavioural test would pass again the moment
// someone reintroduced the leak on a path the test does not exercise.

const AUTH_URL = new URL("../auth.ts", import.meta.url).href;
const DB_URL = new URL("../lib/db.ts", import.meta.url).href;
const CORRECTIONS_URL = new URL("../lib/vin-corrections.ts", import.meta.url).href;

/**
 * Source with comments removed.
 *
 * Both files document the exact patterns these tests ban ("it used to return
 * apiKey.slice(0, 8)"), so asserting against the raw text would match the
 * explanation rather than the code and fail for the wrong reason.
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const EMAIL_TEST_SRC = code("app/api/debug/email-test/route.ts");
const VIN_CORRECTIONS_SRC = readFileSync("app/api/vin/corrections/route.ts", "utf8");
const VIN_CORRECTIONS_CODE = code("app/api/vin/corrections/route.ts");

let instance = 0;

function mockSession(session: unknown) {
  mock.module(AUTH_URL, { namedExports: { auth: async () => session } });
}


// ---------------------- /api/debug/email-test ----------------------

test("the email diagnostic does not exist in production", async () => {
  const previous = process.env.NODE_ENV;
  try {
    // Admin session on purpose: production must 404 even for an admin.
    mockSession({ user: { id: "u1", role: "admin", email: "admin@example.com" } });
    process.env.NODE_ENV = "production";

    const { GET } = await import(`../app/api/debug/email-test/route.ts?case=${++instance}`);
    const res = await GET();

    assert.equal(res.status, 404, "production must not serve the diagnostic");
    const body = await res.json();
    assert.equal(body.error, "Not found");
  } finally {
    process.env.NODE_ENV = previous;
    mock.reset();
  }
});

test("the email diagnostic refuses an anonymous caller", async () => {
  const previous = process.env.NODE_ENV;
  try {
    mockSession(null);
    process.env.NODE_ENV = "development";

    const { GET } = await import(`../app/api/debug/email-test/route.ts?case=${++instance}`);
    const res = await GET();
    assert.equal(res.status, 401);
  } finally {
    process.env.NODE_ENV = previous;
    mock.reset();
  }
});

test("the email diagnostic refuses a signed-in non-admin", async () => {
  const previous = process.env.NODE_ENV;
  try {
    mockSession({ user: { id: "u2", role: "private_seller", email: "seller@example.com" } });
    process.env.NODE_ENV = "development";

    const { GET } = await import(`../app/api/debug/email-test/route.ts?case=${++instance}`);
    const res = await GET();
    assert.equal(res.status, 403);
  } finally {
    process.env.NODE_ENV = previous;
    mock.reset();
  }
});

test("the email diagnostic never reports any part of the API key", () => {
  // It used to return `keyPrefix: apiKey.slice(0, 8)` on two separate paths.
  assert.ok(
    !/apiKey\s*\.\s*slice/.test(EMAIL_TEST_SRC),
    "the API key is being sliced - that leaked the first eight characters to the caller",
  );
  assert.ok(
    !/keyPrefix/.test(EMAIL_TEST_SRC),
    "keyPrefix reports credential material and must not come back",
  );
  // Reporting only whether a key exists is fine and is what diagnoses the fault.
  assert.match(EMAIL_TEST_SRC, /keyConfigured/, "it should still say whether a key is configured");
});

test("the email diagnostic takes no secret from the query string", () => {
  assert.ok(
    !/searchParams\.get\(\s*["']secret["']\s*\)/.test(EMAIL_TEST_SRC),
    "a secret read from the query string ends up in access logs",
  );
  assert.ok(
    !/CRON_SECRET/.test(EMAIL_TEST_SRC),
    "this is a human diagnostic; CRON_SECRET is for unattended callers",
  );
  assert.match(EMAIL_TEST_SRC, /await auth\(\)/, "it must authorize with a session instead");
});

test("the email diagnostic is not an open relay", () => {
  // `?to=` let anyone holding the secret send mail from the company domain to
  // any address. The recipient must come from the session.
  assert.ok(
    !/searchParams\.get\(\s*["']to["']\s*\)/.test(EMAIL_TEST_SRC),
    "the recipient is still taken from the request - that is an open relay",
  );
  assert.match(
    EMAIL_TEST_SRC,
    /const to = session\.user\.email/,
    "the recipient must be the signed-in admin's own address",
  );
});

test("the email diagnostic does not echo the raw provider error", () => {
  assert.ok(
    !/error:\s*error\s*\?\?\s*null/.test(EMAIL_TEST_SRC),
    "returning the provider's error object can expose request and account detail",
  );
  assert.match(EMAIL_TEST_SRC, /error\.message/, "a short message is enough");
});

// ---------------------- /api/vin/corrections ----------------------

test("recording a VIN correction requires a session", async () => {
  mockSession(null);
  const { POST } = await import(`../app/api/vin/corrections/route.ts?case=${++instance}`);

  const res = await POST(
    new Request("http://localhost/api/vin/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin: "1HGBH41JXMN109186", fields: { engineCc: 1400 } }),
    }),
  );

  assert.equal(res.status, 401, "an anonymous caller could steer the VIN learning loop");
  mock.reset();
});

test("an authenticated correction is still recorded", async () => {
  // The guard must not break the workflow it protects.
  const recorded: unknown[][] = [];
  mockSession({ user: { id: "u1", role: "private_seller", email: "s@example.com" } });
  mock.module(DB_URL, { namedExports: { isDbConfigured: () => true } });
  mock.module(CORRECTIONS_URL, {
    namedExports: {
      vinPrefix: (vin: string) => vin.slice(0, 11),
      isCorrectableField: () => true,
      recordCorrection: async (...a: unknown[]) => {
        recorded.push(a);
      },
    },
  });

  const { POST } = await import(`../app/api/vin/corrections/route.ts?case=${++instance}`);
  const res = await POST(
    new Request("http://localhost/api/vin/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin: "1HGBH41JXMN109186", fields: { engineCc: 1400 } }),
    }),
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.recorded, 1, "the correction should still be written for a signed-in seller");
  assert.equal(recorded.length, 1);
  mock.reset();
});

test("the VIN corrections route is no longer described as public", () => {
  assert.ok(
    !/^\/\/ Public/m.test(VIN_CORRECTIONS_SRC),
    "the comment still claims the endpoint is public",
  );
  assert.match(VIN_CORRECTIONS_CODE, /await auth\(\)/);
});

// ---------------------- secret logging ----------------------

test("no one-time code is ever written to the logs", () => {
  // lib/email.ts logged `code=%s` with the live OTP. On a hosted platform
  // those lines are retained and searchable, so anyone with log access could
  // read a valid reset code - turning "attacker needs the user's inbox" into
  // "attacker needs the dashboard".
  //
  // Asserted against the source rather than behaviour: the defect is "this
  // value appears in a log call", which is a property of the code, and a
  // behavioural test would pass again the moment it reappeared on a path the
  // test does not exercise.
  const files = [
    "lib/email.ts",
    "app/api/auth/forgot-password/route.ts",
    "app/api/auth/reset-password/route.ts",
    "app/api/auth/resend-verification/route.ts",
    "app/api/auth/verify-email/route.ts",
    "app/api/auth/register/route.ts",
    "auth.ts",
  ];

  const CONSOLE_CALL = /console\.(?:log|warn|error|info|debug)\s*\(([^;]*?)\)\s*;/gis;
  const SECRET_IDENT = /\b(?:code|otp|password|passwordHash|token|secret)\b/i;
  const STRING_LITERAL = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;

  for (const file of files) {
    const src = code(file);
    for (const match of src.matchAll(CONSOLE_CALL)) {
      // Drop the message string(s) first: "sending verification code to=%s"
      // mentions the word without logging the value. Only the remaining
      // ARGUMENTS can actually carry a secret.
      const args = match[1].replace(STRING_LITERAL, "");
      if (!SECRET_IDENT.test(args)) continue;
      // A Postgres SQLSTATE (e.code / err.code) is a diagnostic like "23505",
      // not a credential, and is genuinely useful in an error log.
      if (/\b(?:e|err|error)\.code\b/.test(args)) continue;
      assert.fail(
        `${file} logs a secret-bearing value: ${match[0].replace(/\s+/g, " ").slice(0, 120)}`,
      );
    }
  }
});

test("the verification email still logs enough to trace a delivery", () => {
  // Removing the secret must not remove operational visibility.
  const src = code("lib/email.ts");
  // Records WHICH kind of code was sent and to whom, but never the code.
  assert.match(src, /console\.log\("\[email\] sending %s code to=%s", purpose, to\)/);
  assert.match(src, /Email sent successfully id=%s/, "the provider message id is how a delivery is traced");
});
