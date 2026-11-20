// Verifies the password-reset SQL in lib/db.ts against a REAL Postgres.
//
// The 15 unit tests in tests/password-reset.test.ts assert the SHAPE of the
// statement (one UPDATE, the right WHERE, RETURNING id). They cannot prove
// that Postgres evaluates the provider CASE as intended, and they cannot test
// concurrency at all. This script does both, by calling the real exported
// function against a Neon staging branch.
//
// WHY NOT scripts/lib/require-test-database.mjs: that guard recognises a test
// target by a label in the host or database name. A Neon branch has neither —
// the host is an opaque endpoint id and the database name is inherited from
// the parent branch. The control here is provenance instead: the target must
// come from STAGING_DATABASE_URL, there is no fallback to DATABASE_URL, and
// the two must differ. A shell carrying only production credentials cannot
// satisfy it.
//
// Every row it touches is one it created, under a distinctive email prefix,
// and it deletes them again. It never reads, updates or deletes a pre-existing
// row, and it asserts the user count returns to its baseline.
//
//   node --import ./tests/helpers/register.mjs scripts/staging/verify-reset.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// ---------------------------------------------------------------- target

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const staging = env.STAGING_DATABASE_URL;
if (!staging) {
  console.error("REFUSED: STAGING_DATABASE_URL is not set in .env.local.");
  console.error("There is deliberately no fallback to DATABASE_URL.");
  process.exit(1);
}
if (env.DATABASE_URL && new URL(staging).hostname === new URL(env.DATABASE_URL).hostname) {
  console.error("REFUSED: STAGING_DATABASE_URL points at the same endpoint as DATABASE_URL.");
  process.exit(1);
}

// lib/db.ts reads DATABASE_URL. Point it at staging for this process only,
// and drop any inherited value so nothing can fall back to it.
delete process.env.DATABASE_URL;
process.env.DATABASE_URL = staging;

const { query, setResetCode, consumeResetCode } = await import("@/lib/db");

const url = new URL(staging);
console.log("target: %s / %s\n", url.hostname.split("-pooler")[0], url.pathname.slice(1));

// ---------------------------------------------------------------- fixtures

const RUN = Date.now().toString(36);
const PREFIX = `zz-reset-${RUN}-`;
const mk = (tag) => `${PREFIX}${tag}@staging.invalid`;
const HASH = (n) => `$2a$12$verify${RUN}${n}`.padEnd(60, "x").slice(0, 60);

const before = (await query("SELECT count(*)::int AS n FROM users"))[0].n;
const collide = (await query("SELECT count(*)::int AS n FROM users WHERE email LIKE $1", [
  `${PREFIX}%`,
]))[0].n;
assert.equal(collide, 0, "fixture emails must not already exist");

const created = [];
async function makeUser(tag, provider) {
  const email = mk(tag);
  await query(
    `INSERT INTO users (email, name, provider, password_hash, email_verified)
     VALUES ($1, 'staging fixture', $2, NULL, FALSE)`,
    [email, provider],
  );
  created.push(email);
  return email;
}

const read = async (email) =>
  (await query(
    `SELECT provider, password_hash, reset_code, reset_code_expires_at, email_verified
       FROM users WHERE email = $1`,
    [email],
  ))[0];

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log("  PASS  " + label);
  } catch (e) {
    failures++;
    console.log("  FAIL  " + label + "\n        " + e.message);
  }
}

try {
  // ------------------------------------------------ 1. provider merge
  console.log("1. provider merge - 'email' added once, existing methods kept\n");

  const cases = [
    ["email", "email", "email"],
    ["google", "google", "google,email"],
    ["bothfirst", "email,google", "email,google"],
    ["bothlast", "google,email", "google,email"],
    ["empty", "", "email"],
    ["three", "google,email,phone", "google,email,phone"],
  ];

  for (const [tag, start, expected] of cases) {
    const email = await makeUser(tag, start);
    const set = await setResetCode(email, "111111");
    const ok = await consumeResetCode(email, "111111", HASH(tag));
    const row = await read(email);

    check(`${JSON.stringify(start).padEnd(21)} -> ${JSON.stringify(row.provider)}`, () => {
      assert.equal(set, true, "setResetCode should have matched the row");
      assert.equal(ok, true, "the reset should have succeeded");
      assert.equal(row.provider, expected, `expected ${JSON.stringify(expected)}`);
      assert.equal(
        row.provider.split(",").filter((p) => p === "email").length,
        1,
        "'email' must appear exactly once",
      );
      if (start.includes("google")) {
        assert.ok(row.provider.includes("google"), "google must be preserved");
      }
      assert.equal(row.password_hash, HASH(tag), "the new hash must be stored");
      assert.equal(row.reset_code, null, "the code must be consumed");
      assert.equal(row.reset_code_expires_at, null, "the expiry must be cleared");
      assert.equal(row.email_verified, true, "a completed reset proves the address");
    });
  }

  // ------------------------------------------------ 2. single use
  console.log("\n2. single use\n");

  const reuse = await makeUser("reuse", "email");
  await setResetCode(reuse, "222222");
  const firstUse = await consumeResetCode(reuse, "222222", HASH("r1"));
  const secondUse = await consumeResetCode(reuse, "222222", HASH("r2"));
  const reuseRow = await read(reuse);
  check("a consumed code cannot be used again", () => {
    assert.equal(firstUse, true, "the first use should succeed");
    assert.equal(secondUse, false, "the second use must fail");
    assert.equal(reuseRow.password_hash, HASH("r1"), "the first hash must survive");
  });

  const wrong = await makeUser("wrong", "email");
  await setResetCode(wrong, "333333");
  const wrongOk = await consumeResetCode(wrong, "999999", HASH("w"));
  const wrongRow = await read(wrong);
  check("a wrong code does not match and changes nothing", () => {
    assert.equal(wrongOk, false, "a wrong code must not match");
    assert.equal(wrongRow.password_hash, null, "no password should have been written");
    assert.equal(wrongRow.reset_code, "333333", "the real code must survive a wrong guess");
  });

  const expired = await makeUser("expired", "email");
  await query(
    `UPDATE users SET reset_code = '444444',
            reset_code_expires_at = NOW() - INTERVAL '1 minute'
      WHERE email = $1`,
    [expired],
  );
  const expiredOk = await consumeResetCode(expired, "444444", HASH("e"));
  const expiredRow = await read(expired);
  check("an expired code does not match", () => {
    assert.equal(expiredOk, false, "an expired code must not match");
    assert.equal(expiredRow.password_hash, null, "an expired code must not set a password");
  });

  // ------------------------------------------------ 3. concurrency
  console.log("\n3. concurrency - two simultaneous submissions of one code\n");

  for (let round = 1; round <= 3; round++) {
    const race = await makeUser(`race${round}`, "google");
    await setResetCode(race, "555555");

    // Both in flight at once: no await between them.
    const [a, b] = await Promise.all([
      consumeResetCode(race, "555555", HASH(`a${round}`)),
      consumeResetCode(race, "555555", HASH(`b${round}`)),
    ]);
    const row = await read(race);

    check(`round ${round}: exactly one submission won (a=${a} b=${b})`, () => {
      assert.equal([a, b].filter(Boolean).length, 1, `expected one winner, got a=${a} b=${b}`);
      assert.equal(
        row.password_hash,
        a ? HASH(`a${round}`) : HASH(`b${round}`),
        "the stored hash must be the winner's",
      );
      assert.equal(row.reset_code, null, "the code must be consumed");
      assert.equal(row.provider, "google,email", "the merge must survive the race");
    });
  }

  // ------------------------------------------------ 4. forced interleave
  //
  // Part 3 is weak on its own: Promise.all does not guarantee the two
  // statements were ever concurrent AT THE DATABASE - the pool may simply
  // have run them one after another, in which case the test proves nothing
  // about locking. The winner being 'a' every round is consistent with that.
  //
  // This part removes the doubt. Two independent connections, and an
  // explicit transaction held open so the second UPDATE provably arrives
  // while the first is still uncommitted. The single-statement design relies
  // on READ COMMITTED re-checking the WHERE clause after the blocking row
  // lock is released; this is the test of exactly that.
  console.log("\n4. forced interleave - second UPDATE arrives mid-transaction\n");

  const { Pool } = await import("@neondatabase/serverless");
  const poolA = new Pool({ connectionString: staging });
  const poolB = new Pool({ connectionString: staging });

  const SQL = `UPDATE users
                  SET password_hash = $3, reset_code = NULL, reset_code_expires_at = NULL
                WHERE email = $1 AND reset_code = $2 AND reset_code_expires_at > NOW()
                RETURNING id`;

  try {
    const email = await makeUser("interleave", "email");
    await setResetCode(email, "666666");

    const a = await poolA.connect();
    const b = await poolB.connect();
    try {
      await a.query("BEGIN");
      const aRows = await a.query(SQL, [email, "666666", HASH("ia")]);

      // B now issues the same statement. It must block on A's row lock.
      let bSettled = false;
      const bPromise = b.query(SQL, [email, "666666", HASH("ib")]).then((r) => {
        bSettled = true;
        return r;
      });

      await new Promise((r) => setTimeout(r, 700));
      const blockedWhileOpen = !bSettled;

      await a.query("COMMIT");
      const bRows = await bPromise;
      const row = await read(email);

      check("the second UPDATE blocked while the first was uncommitted", () => {
        assert.equal(blockedWhileOpen, true,
          "B returned before A committed - it never contended for the row, so this test is not measuring locking");
      });
      check("after the lock released, the second UPDATE matched zero rows", () => {
        assert.equal(aRows.rows.length, 1, "A should have matched the row");
        assert.equal(bRows.rows.length, 0,
          "B matched a row - two concurrent submissions can both reset the password");
      });
      check("the committed password is the first writer's", () => {
        assert.equal(row.password_hash, HASH("ia"));
        assert.equal(row.reset_code, null);
      });
    } finally {
      a.release();
      b.release();
    }
  } finally {
    await poolA.end().catch(() => {});
    await poolB.end().catch(() => {});
  }
} finally {
  // ------------------------------------------------ cleanup
  console.log("\ncleanup\n");
  const del = await query("DELETE FROM users WHERE email LIKE $1 RETURNING id", [`${PREFIX}%`]);
  const after = (await query("SELECT count(*)::int AS n FROM users"))[0].n;
  console.log(
    "  created %d fixtures, deleted %d, users %d -> %d",
    created.length, del.length, before, after,
  );
  if (after !== before) {
    console.log("  WARNING: user count did not return to baseline");
    failures++;
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
