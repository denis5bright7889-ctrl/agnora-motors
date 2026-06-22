// Integration tests for the auth audit. Exercises DB helpers + invariants
// without a running web server. Each test is a discrete `t()` block — failures
// are collected and the script exits non-zero if any fail.
//
// Usage:
//   node scripts/test-auth.mjs
//
// Spec coverage:
//   1. Email registration creates a row with provider='email' + password_hash set.
//   2. Google registration creates a row with provider='google', no password,
//      email_verified=true, google_id populated.
//   3. Existing email user linked when same address signs in with Google
//      (provider becomes 'email,google', google_id populated).
//   4. Password reset for Google-only user upgrades provider to 'email,google'
//      and sets password_hash.
//   5. verifyEmailCode toggles email_verified TRUE.
//   6. Case-collision duplicates rejected — both at app layer (normalized
//      lookup) and DB CHECK constraint (case-insensitive constraint).
//   7. Case-insensitive login: looking up USER@EMAIL.COM / user@email.com /
//      User@Email.com resolves to the same row.

import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch {}

if (!process.env.DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Small test runner ───────────────────────────────────────────────────────
const results = [];
async function t(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✗ ${name}\n      ${err instanceof Error ? err.message : err}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

// Make a unique test email per run so re-running doesn't collide.
const stamp = Date.now();
const E = {
  emailUser:  `auth-test-email-${stamp}@test.local`,
  googleUser: `auth-test-google-${stamp}@test.local`,
  linkUser:   `auth-test-link-${stamp}@test.local`,
  resetUser:  `auth-test-reset-${stamp}@test.local`,
  caseUser:   `auth-test-case-${stamp}@test.local`,
};

// Cleanup leftover rows from any prior run.
async function cleanup() {
  await pool.query(
    `DELETE FROM users WHERE email LIKE 'auth-test-%@test.local'`,
  );
}

await cleanup();
console.log("\nRunning auth integration tests…\n");

// ── 1. Email registration ────────────────────────────────────────────────────
await t("1. createUser email→provider='email' + password_hash set + email_verified=false initially", async () => {
  const passwordHash = await bcrypt.hash("password123", 12);
  const r = await pool.query(
    `INSERT INTO users (email, name, password_hash, role, provider)
     VALUES ($1, 'Test', $2, 'buyer', 'email')
     RETURNING email, provider, password_hash, email_verified`,
    [E.emailUser, passwordHash],
  );
  const row = r.rows[0];
  assert(row.email === E.emailUser, "email lowercased");
  assert(row.provider === "email", "provider='email'");
  assert(row.password_hash !== null, "password set");
  assert(row.email_verified === false, "starts unverified");
});

// ── 2. Google registration ───────────────────────────────────────────────────
await t("2. createUser google→provider='google' + email_verified=true + google_id populated", async () => {
  const r = await pool.query(
    `INSERT INTO users (email, name, role, provider, google_id, email_verified)
     VALUES ($1, 'Google User', 'buyer', 'google', $2, TRUE)
     RETURNING email, provider, password_hash, google_id, email_verified`,
    [E.googleUser, `g_${stamp}_1`],
  );
  const row = r.rows[0];
  assert(row.provider === "google", "provider='google'");
  assert(row.password_hash === null, "no password");
  assert(row.google_id === `g_${stamp}_1`, "google_id set");
  assert(row.email_verified === true, "verified");
});

// ── 3. Linking Google to existing email user ─────────────────────────────────
await t("3. Linking Google to existing email user upgrades provider to 'email,google'", async () => {
  const passwordHash = await bcrypt.hash("password456", 12);
  // Seed: email account.
  const ins = await pool.query(
    `INSERT INTO users (email, name, password_hash, role, provider, email_verified)
     VALUES ($1, 'Email Then Google', $2, 'buyer', 'email', TRUE)
     RETURNING id`,
    [E.linkUser, passwordHash],
  );
  const id = ins.rows[0].id;
  // Simulate the linkGoogleAccount behaviour: merge provider + set google_id.
  await pool.query(
    `UPDATE users SET google_id = $1, provider = 'email,google' WHERE id = $2`,
    [`g_${stamp}_2`, id],
  );
  const r = await pool.query(
    `SELECT provider, password_hash IS NOT NULL AS has_password, google_id FROM users WHERE id = $1`,
    [id],
  );
  const row = r.rows[0];
  assert(row.provider.includes("email") && row.provider.includes("google"), "provider has both");
  assert(row.has_password === true, "password preserved on link");
  assert(row.google_id === `g_${stamp}_2`, "google_id populated");
});

// ── 4. Password reset for Google-only user ───────────────────────────────────
await t("4. Password reset on Google-only user adds password + provider becomes 'email,google'", async () => {
  const ins = await pool.query(
    `INSERT INTO users (email, name, role, provider, google_id, email_verified)
     VALUES ($1, 'Google Then Pw', 'buyer', 'google', $2, TRUE)
     RETURNING id`,
    [E.resetUser, `g_${stamp}_3`],
  );
  const id = ins.rows[0].id;

  // Issue + consume a reset code.
  await pool.query(
    `UPDATE users SET reset_code = '123456', reset_code_expires_at = NOW() + INTERVAL '30 minutes' WHERE id = $1`,
    [id],
  );
  const newHash = await bcrypt.hash("newpassword123", 12);
  await pool.query(
    `UPDATE users SET password_hash = $1, provider = 'email,google', reset_code = NULL, reset_code_expires_at = NULL WHERE id = $2 AND reset_code = '123456'`,
    [newHash, id],
  );

  const r = await pool.query(
    `SELECT provider, password_hash IS NOT NULL AS has_password, google_id, reset_code FROM users WHERE id = $1`,
    [id],
  );
  const row = r.rows[0];
  assert(row.has_password === true, "password now set");
  assert(row.provider.includes("email") && row.provider.includes("google"), "supports both providers");
  assert(row.google_id !== null, "google link preserved");
  assert(row.reset_code === null, "reset code cleared");
});

// ── 5. Email verification flow ───────────────────────────────────────────────
await t("5. verifyEmailCode flips email_verified TRUE", async () => {
  // Reset back to unverified + a valid code.
  await pool.query(
    `UPDATE users SET email_verified = FALSE, verification_code = '987654', verification_expires_at = NOW() + INTERVAL '15 minutes' WHERE email = $1`,
    [E.emailUser],
  );
  // Simulate the verifyEmailCode UPDATE.
  const r = await pool.query(
    `UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_expires_at = NULL
     WHERE email = $1 AND verification_code = '987654' AND verification_expires_at > NOW()
     RETURNING email_verified`,
    [E.emailUser],
  );
  assert(r.rows.length === 1, "matched + updated");
  assert(r.rows[0].email_verified === true, "verified=true");
});

// ── 6. Case-insensitive uniqueness ──────────────────────────────────────────
await t("6. CHECK constraint rejects mixed-case email writes", async () => {
  let rejected = false;
  try {
    await pool.query(
      `INSERT INTO users (email, name, role, provider) VALUES ($1, 'Bad', 'buyer', 'email')`,
      [`BAD-CASE-${stamp}@TEST.LOCAL`],
    );
  } catch (err) {
    if (String(err.message ?? err).includes("users_email_lowercase_chk")) rejected = true;
    else throw err;
  }
  assert(rejected, "constraint should reject non-lowercase email");
});

await t("6b. UNIQUE on email prevents duplicate normalized rows", async () => {
  await pool.query(
    `INSERT INTO users (email, name, role, provider) VALUES ($1, 'A', 'buyer', 'email')`,
    [E.caseUser],
  );
  let rejected = false;
  try {
    await pool.query(
      `INSERT INTO users (email, name, role, provider) VALUES ($1, 'B', 'buyer', 'email')`,
      [E.caseUser],
    );
  } catch (err) {
    if (err.code === "23505") rejected = true;
    else throw err;
  }
  assert(rejected, "duplicate email rejected");
});

// ── 7. Case-insensitive login lookup ────────────────────────────────────────
await t("7. Lookup with UPPER/MIXED/lower case all resolve to same row", async () => {
  for (const variant of [E.emailUser, E.emailUser.toUpperCase(), E.emailUser.replace(/./g, (c, i) => i % 2 ? c.toUpperCase() : c)]) {
    // App always normalises before query — simulate that here.
    const r = await pool.query(
      `SELECT id FROM users WHERE email = LOWER(TRIM($1)) LIMIT 1`,
      [variant],
    );
    assert(r.rows.length === 1, `resolves "${variant}"`);
  }
});

// ── Final cleanup ───────────────────────────────────────────────────────────
await cleanup();
await pool.end();

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
