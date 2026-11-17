// One-shot diagnostic: dumps the canonical login-relevant facts for
// a single account so the right error message can be traced end-to-end.
// Usage:  node scripts/diagnose-auth.mjs <email>
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

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

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) { console.error("Usage: node scripts/diagnose-auth.mjs <email>"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query(
  `SELECT id, email, name, role,
          provider,
          (password_hash IS NOT NULL)    AS has_password,
          COALESCE(LENGTH(password_hash), 0) AS password_hash_len,
          email_verified,
          (google_id     IS NOT NULL)    AS has_google,
          google_id,
          is_active,
          last_login_at,
          (reset_code    IS NOT NULL)    AS has_pending_reset,
          reset_code_expires_at,
          created_at
   FROM users
   WHERE email = $1
   LIMIT 1`,
  [email],
);

if (r.rows.length === 0) {
  console.log(JSON.stringify({ email, exists: false }, null, 2));
} else {
  const u = r.rows[0];
  const out = {
    email:                u.email,
    exists:               true,
    provider:             u.provider,
    has_password:         u.has_password,
    password_hash_len:    u.password_hash_len,
    email_verified:       u.email_verified,
    has_google:           u.has_google,
    google_id_prefix:     u.google_id ? String(u.google_id).slice(0, 12) + "…" : null,
    is_active:            u.is_active,
    role:                 u.role,
    last_login_at:        u.last_login_at,
    has_pending_reset:    u.has_pending_reset,
    reset_code_expires:   u.reset_code_expires_at,
    created_at:           u.created_at,
  };
  // Derived: what auth.ts authorize() will do given this record.
  const derived = {
    canLoginWithPassword: u.has_password && u.email_verified && u.is_active,
    canLoginWithGoogle:   u.has_google,
    expectedCredentialsErrorCode:
      !u.has_password  ? "use_google" :
      !u.email_verified ? "email_not_verified" :
      !u.is_active     ? "account_inactive" :
      null /* wrong-password attempts produce invalid_credentials at runtime */,
  };
  console.log(JSON.stringify({ db: out, derived }, null, 2));
}

await pool.end();
