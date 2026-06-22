// Read-only inspection of the users table state for the auth audit.
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
if (!process.env.DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("\nUsers table columns:");
const cols = await pool.query(
  `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'users'
   ORDER BY ordinal_position`,
);
console.table(cols.rows);

const totalRow = (await pool.query("SELECT COUNT(*)::INT AS n FROM users")).rows[0];
console.log(`\nTotal users: ${totalRow.n}\n`);

if (totalRow.n > 0) {
  console.log("Users by case-collision + provider state:");
  const dups = await pool.query(
    `SELECT LOWER(email) AS lower_email,
            COUNT(*)::INT AS count,
            COUNT(*) FILTER (WHERE password_hash IS NOT NULL)::INT AS with_password,
            BOOL_OR(email_verified) AS any_verified
     FROM users
     GROUP BY LOWER(email)
     HAVING COUNT(*) > 1
     ORDER BY count DESC`,
  );
  if (dups.rows.length > 0) console.table(dups.rows);
  else console.log("  No case-collision duplicates.\n");

  console.log("Sample of 10 users:");
  const sample = await pool.query(
    `SELECT id, email, name, role,
            email_verified,
            password_hash IS NOT NULL AS has_password,
            created_at
     FROM users ORDER BY created_at DESC LIMIT 10`,
  );
  console.table(sample.rows.map((r) => ({
    id_prefix:  String(r.id).slice(0, 12) + "…",
    email:      r.email,
    role:       r.role,
    verified:   r.email_verified,
    has_pw:     r.has_password,
    created:    new Date(r.created_at).toISOString().slice(0, 10),
  })));
}

await pool.end();
