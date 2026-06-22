// Runs a single .sql file against DATABASE_URL.
// Usage: node scripts/run-migration.mjs db/migrations/<file>.sql
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
const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/run-migration.mjs <path>"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const sql = readFileSync(file, "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
console.log(`Running ${file}…`);
await pool.query(sql);
console.log("Done.");
await pool.end();
