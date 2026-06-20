// Applies every .sql file in /db against the DATABASE_URL in .env.local.
// Records which files have been applied in a `schema_migrations` table so
// reruns are no-ops, prints per-file durations, and exits non-zero on failure.
//
// Files are still expected to be idempotent (IF NOT EXISTS guards) — the
// table is a fast-path for `npm run db:migrate` after a fresh deploy.
//
// The connection string is read inside the script and NEVER printed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

// ── env ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const url = env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

const host = (() => { try { return new URL(url).hostname; } catch { return "(unparseable)"; } })();
console.log(`Connecting to Neon host: ${host}\n`);

const pool = new Pool({ connectionString: url });

// ── statement splitter (respects $$…$$ dollar quotes + comments) ────────────
function splitStatements(sql) {
  const out = [];
  let buf = "", i = 0;
  let inLine = false, inBlock = false, dollarTag = null;
  while (i < sql.length) {
    const c  = sql[i];
    const c2 = sql.slice(i, i + 2);
    if (inLine) { buf += c; if (c === "\n") inLine = false; i++; continue; }
    if (inBlock) { buf += c; if (c2 === "*/") { buf += "/"; i += 2; inBlock = false; continue; } i++; continue; }
    if (dollarTag) {
      buf += c;
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag.slice(1); i += dollarTag.length; dollarTag = null; continue; }
      i++; continue;
    }
    if (c2 === "--") { buf += c2; inLine = true; i += 2; continue; }
    if (c2 === "/*") { buf += c2; inBlock = true; i += 2; continue; }
    const dm = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z_0-9]*)?\$/);
    if (dm) { dollarTag = dm[0]; buf += dollarTag; i += dollarTag.length; continue; }
    if (c === ";") { const s = buf.trim(); if (s) out.push(s); buf = ""; i++; continue; }
    buf += c; i++;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

// ── migrations table ───────────────────────────────────────────────────────
await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename     TEXT PRIMARY KEY,
    checksum     TEXT NOT NULL,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms  INT NOT NULL
  );
`);

// ── runner ──────────────────────────────────────────────────────────────────
const applied = new Map(
  (await pool.query(`SELECT filename, checksum FROM schema_migrations`)).rows
    .map((r) => [r.filename, r.checksum])
);

async function runFile(path, filename) {
  const sql = readFileSync(path, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);

  // schema.sql is the source-of-truth file — it's mutated as the schema evolves
  // (PRs add new columns + tables to it) so its checksum legitimately changes
  // and we re-apply every run. Every statement in it is IF NOT EXISTS guarded.
  const isLiveSchema = filename === "schema.sql";

  if (!isLiveSchema && applied.get(filename) === checksum) {
    console.log(`  ${filename} — already applied (skip)`);
    return { ok: true, skipped: true };
  }

  const stmts = splitStatements(sql);
  const t0 = Date.now();
  let ok = 0;
  const errors = [];
  for (let n = 0; n < stmts.length; n++) {
    try {
      await pool.query(stmts[n]);
      ok++;
    } catch (e) {
      errors.push({ n: n + 1, head: stmts[n].slice(0, 80).replace(/\s+/g, " "), msg: e.message, code: e.code });
    }
  }
  const ms = Date.now() - t0;

  if (errors.length === 0) {
    await pool.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO UPDATE SET
         checksum    = EXCLUDED.checksum,
         duration_ms = EXCLUDED.duration_ms,
         applied_at  = NOW()`,
      [filename, checksum, ms],
    );
    console.log(`  ${filename} — ${ok}/${stmts.length} statements OK in ${ms} ms`);
    return { ok: true, skipped: false, ms };
  } else {
    console.log(`  ${filename} — ${ok}/${stmts.length} OK, ${errors.length} ERROR(s) in ${ms} ms`);
    for (const e of errors.slice(0, 8)) {
      console.log(`    #${e.n} [${e.code ?? "?"}] ${e.head}…  →  ${e.msg.slice(0, 140)}`);
    }
    if (errors.length > 8) console.log(`    …and ${errors.length - 8} more`);
    return { ok: false, ms, errors };
  }
}

// ── discover and run all /db/*.sql in deterministic order ───────────────────
// schema.sql always runs first (it defines tables the others may extend),
// then everything else alphabetically.
const dbDir = "db";
const all = readdirSync(dbDir).filter((f) => f.endsWith(".sql") && statSync(join(dbDir, f)).isFile());
const ordered = ["schema.sql", ...all.filter((f) => f !== "schema.sql").sort()];

let allOk = true;
for (const f of ordered) {
  const r = await runFile(join(dbDir, f), f);
  allOk = r.ok && allOk;
}

// ── sanity probe (proves the helper-critical columns exist) ─────────────────
const probe = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'cars'
    AND column_name IN ('vin','vin_verified','drivetrain','engine_size_l','seller_name','seller_phone')
  ORDER BY column_name
`);
console.log(`\ncars columns present: ${probe.rows.map((r) => r.column_name).join(", ")}`);

await pool.end();
console.log(allOk ? "\nDone." : "\nFinished with errors (see above).");
process.exit(allOk ? 0 : 1);
