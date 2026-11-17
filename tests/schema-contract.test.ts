import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// Verifies that what lib/db.ts asks the database for is what the migrations
// actually create.
//
// This exists because the failure mode is invisible until runtime and then
// total: a column named in a SELECT list that the DDL never created throws
// "column does not exist" on every call, and a mismatch between an INSERT's
// column count and its placeholder count throws "bind message supplies N
// parameters". Both are trivially preventable by reading the two files
// together, which is all this does.
//
// It is static on purpose: it needs no database, so it runs in CI and on a
// machine whose migrations have not been applied.

const DB = readFileSync("lib/db.ts", "utf8");

const MIGRATIONS = [
  "db/migrations/2026-09-16-car-photos.sql",
  "db/migrations/2026-11-17-photo-quality.sql",
].filter(existsSync);

/** Columns a table really has, from CREATE TABLE plus later ADD COLUMNs. */
function ddlColumns(table: string): Set<string> {
  const cols = new Set<string>();

  for (const file of MIGRATIONS) {
    const sql = readFileSync(file, "utf8");

    // CREATE TABLE [IF NOT EXISTS] <table> ( ... );
    const create = new RegExp(
      `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
      "i",
    ).exec(sql);
    if (create) {
      for (const raw of create[1].split("\n")) {
        const line = raw.replace(/--.*$/, "").trim();
        if (!line) continue;
        // Skip table-level constraint clauses.
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line)) continue;
        const m = /^([a-z_][a-z0-9_]*)\s+/i.exec(line);
        if (m) cols.add(m[1].toLowerCase());
      }
    }

    // ALTER TABLE <table> ADD COLUMN [IF NOT EXISTS] <col> ...
    const addCol = new RegExp(
      `ALTER\\s+TABLE\\s+${table}\\s+ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-z_][a-z0-9_]*)`,
      "gi",
    );
    for (const m of sql.matchAll(addCol)) cols.add(m[1].toLowerCase());
  }

  return cols;
}

test("the photo migrations are present", () => {
  assert.equal(MIGRATIONS.length, 2, `expected both migrations, found ${MIGRATIONS.join(", ")}`);
});

test("car_photos DDL defines every column the code selects", () => {
  const ddl = ddlColumns("car_photos");
  assert.ok(ddl.size > 10, `parsed too few columns (${ddl.size}) — parser or DDL changed`);

  const block = /const CAR_PHOTO_COLS = `([\s\S]*?)`;/.exec(DB);
  assert.ok(block, "CAR_PHOTO_COLS not found in lib/db.ts");

  // Each entry is `p.col` or `p.col AS "alias"`; we want the real column,
  // without the table qualifier.
  const selected = block[1]
    .split(",")
    .map((part) => part.trim()
      .replace(/\s+AS\s+"[^"]+"$/i, "")
      .trim()
      .replace(/^[a-z]+\./i, "")
      .toLowerCase())
    .filter(Boolean);

  assert.ok(selected.length >= 20, `expected a full select list, got ${selected.length}`);
  for (const col of selected) {
    assert.ok(ddl.has(col), `CAR_PHOTO_COLS selects "${col}", which no migration creates`);
  }
});

test("CAR_PHOTO_COLS is fully table-qualified", () => {
  // Regression test for a bug that only appeared once the table existed.
  //
  // The list was written with bare column names, which is valid for a
  // single-table SELECT but not for listPendingCarPhotos, which joins
  // car_photos to cars. Both tables have id, status, created_at and
  // updated_at, so Postgres rejected the whole query with
  // 'column reference "id" is ambiguous' and the admin pending-photo queue
  // failed outright.
  const block = /const CAR_PHOTO_COLS = `([\s\S]*?)`;/.exec(DB);
  assert.ok(block, "CAR_PHOTO_COLS not found");

  for (const raw of block[1].split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const column = entry.replace(/\s+AS\s+"[^"]+"$/i, "").trim();
    assert.match(
      column,
      /^p\./,
      `"${column}" is not qualified; it will be ambiguous in any joined query`,
    );
  }
});

test("every query using CAR_PHOTO_COLS aliases car_photos as p", () => {
  // The qualification above is only correct if the alias actually exists.
  const uses = [...DB.matchAll(/\$\{CAR_PHOTO_COLS\}([\s\S]{0,200}?)(?:WHERE|ORDER BY|LIMIT)/g)];
  assert.ok(uses.length >= 3, `expected at least 3 uses, found ${uses.length}`);

  for (const use of uses) {
    assert.match(
      use[1],
      /FROM car_photos p\b/,
      `a CAR_PHOTO_COLS query does not alias car_photos as p: ${use[1].slice(0, 80)}`,
    );
  }
});

test("car_photos INSERT targets only columns the DDL creates", () => {
  const ddl = ddlColumns("car_photos");
  const m = /INSERT INTO car_photos\s*\n\s*\(([\s\S]*?)\)\s*\n\s*VALUES/.exec(DB);
  assert.ok(m, "INSERT INTO car_photos column list not found");

  const cols = m[1].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  for (const col of cols) {
    assert.ok(ddl.has(col), `INSERT writes "${col}", which no migration creates`);
  }
});

test("insertCarPhotos binds exactly one placeholder per inserted column", () => {
  // The regression guard for a real bug: when the quality columns were added,
  // the VALUES template was left one placeholder short and misaligned, so
  // quality_detail received the verdict and public_id received nothing.
  const insert = /INSERT INTO car_photos\s*\n\s*\(([\s\S]*?)\)\s*\n\s*VALUES/.exec(DB);
  assert.ok(insert, "INSERT column list not found");
  const columnCount = insert[1].split(",").filter((c) => c.trim()).length;

  // The VALUES tuple template, built as a template literal using `b + N`,
  // read from inside insertCarPhotos for the same reason as params.push below.
  const scope = DB.slice(
    DB.indexOf("export async function insertCarPhotos"),
    DB.indexOf("INSERT INTO car_photos", DB.indexOf("export async function insertCarPhotos")),
  );
  const tuple = /values\.push\(\s*([\s\S]*?)\);/.exec(scope);
  assert.ok(tuple, "values.push template not found inside insertCarPhotos");

  const placeholders = [...tuple[1].matchAll(/\$(?:\{b \+ (\d+)\}|(\d+))/g)]
    .map((m) => (m[1] !== undefined ? `b+${m[1]}` : `$${m[2]}`));

  assert.equal(
    placeholders.length,
    columnCount,
    `INSERT lists ${columnCount} columns but the tuple has ${placeholders.length} placeholders`,
  );

  // Distinct placeholders = how many params each photo must push. `url` is
  // bound twice (url and original_url), and $1 is the shared car id.
  const distinctOffsets = new Set(placeholders.filter((p) => p.startsWith("b+")));

  // Scope to insertCarPhotos: lib/db.ts has several params.push sites, and
  // matching the first one in the file measures an unrelated function.
  const fnStart = DB.indexOf("export async function insertCarPhotos");
  assert.ok(fnStart > 0, "insertCarPhotos not found");
  const fnBody = DB.slice(fnStart, DB.indexOf("INSERT INTO car_photos", fnStart));

  const push = /params\.push\(\s*([\s\S]*?)\n\s*\);/.exec(fnBody);
  assert.ok(push, "params.push block not found inside insertCarPhotos");
  // Count top-level comma-separated expressions, ignoring commas nested in
  // calls or ternaries by tracking parenthesis depth.
  const body = push[1];
  let depth = 0;
  let count = 1;
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) count++;
  }
  // A trailing comma would overcount by one.
  if (/,\s*$/.test(body.trim())) count--;

  assert.equal(
    count,
    distinctOffsets.size,
    `params.push supplies ${count} values but the tuple references ${distinctOffsets.size} distinct placeholders`,
  );
});

test("upload_classifications DDL defines every column the code uses", () => {
  const ddl = ddlColumns("upload_classifications");
  assert.ok(ddl.size > 5, `parsed too few columns (${ddl.size})`);

  const insert = /INSERT INTO upload_classifications\s*\n\s*\(([\s\S]*?)\)\s*\n\s*VALUES/.exec(DB);
  assert.ok(insert, "INSERT INTO upload_classifications not found");
  const cols = insert[1].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);

  for (const col of cols) {
    assert.ok(ddl.has(col), `INSERT writes "${col}", which no migration creates`);
  }

  // And the read path.
  const select = /SELECT url, label, score, provider, sha256,([\s\S]*?)FROM upload_classifications/.exec(DB);
  assert.ok(select, "upload_classifications SELECT not found");
  const read = select[1]
    .split(",")
    .map((p) => p.trim().replace(/\s+AS\s+"[^"]+"$/i, "").trim().toLowerCase())
    .filter(Boolean);
  for (const col of [...read, "url", "label", "score", "provider", "sha256"]) {
    assert.ok(ddl.has(col), `SELECT reads "${col}", which no migration creates`);
  }
});

test("upload_classifications INSERT arity matches its parameter list", () => {
  const m = /INSERT INTO upload_classifications\s*\n\s*\(([\s\S]*?)\)\s*\n\s*VALUES\s*\(([\s\S]*?)\)/.exec(DB);
  assert.ok(m, "INSERT ... VALUES not found");
  const columnCount = m[1].split(",").filter((c) => c.trim()).length;
  const placeholderCount = [...m[2].matchAll(/\$\d+/g)].length;
  assert.equal(
    placeholderCount,
    columnCount,
    `${columnCount} columns but ${placeholderCount} placeholders`,
  );
});

test("the quality verdicts the code writes are permitted by the CHECK constraint", () => {
  // lib/image-quality.ts can emit any of these; the constraint must allow all
  // of them or a perfectly good assessment fails the write.
  const sql = MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n");
  const check = /car_photos_quality_verdict_check[\s\S]*?IN\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(check, "quality verdict CHECK constraint not found");
  const allowed = [...check[1].matchAll(/'([a-z_]+)'/gi)].map((x) => x[1]);

  for (const verdict of ["good", "acceptable", "review", "reject", "unknown"]) {
    assert.ok(allowed.includes(verdict), `CHECK constraint forbids verdict "${verdict}"`);
  }
});

test("the photo statuses the code writes are permitted by the CHECK constraint", () => {
  const sql = MIGRATIONS.map((f) => readFileSync(f, "utf8")).join("\n");
  const check = /car_photos_status_check[\s\S]*?IN\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(check, "status CHECK constraint not found");
  const allowed = [...check[1].matchAll(/'([a-z_]+)'/gi)].map((x) => x[1]);

  // seedCarPhotosFromUrls writes 'approved' or 'pending'; the admin route
  // writes all three.
  for (const status of ["approved", "pending", "rejected"]) {
    assert.ok(allowed.includes(status), `CHECK constraint forbids status "${status}"`);
  }
});
