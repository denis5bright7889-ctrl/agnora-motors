import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Tests for setPrimaryCarPhoto against a fake connection pool. No database is
// contacted: @neondatabase/serverless is replaced wholesale, so the real SQL
// in lib/db.ts is inspected rather than executed.
//
// The invariant under test is "exactly one primary photo per listing". The
// admin table, the listing detail page and every public card pick the primary
// to show, so a listing with none renders without a lead image, and a listing
// with two is non-deterministic.

const DATABASE_URL = "postgres://unit-test:unit-test@127.0.0.1:1/not-a-real-database";

interface Issued {
  text: string;
  params: unknown[];
}

/**
 * Installs a fake Pool and returns the log of statements it receives.
 * `rowCounts` supplies a rowCount per statement, in order.
 */
function fakePool(rowCounts: number[] = []) {
  const issued: Issued[] = [];
  let n = 0;

  class Pool {
    async query(text: string, params: unknown[] = []) {
      issued.push({ text, params });
      const rowCount = rowCounts[n] ?? 1;
      n += 1;
      // Mirror a real driver: RETURNING yields one row per affected row.
      return { rows: Array.from({ length: rowCount }, (_, i) => ({ id: `row-${i}` })), rowCount };
    }
    async end() {}
  }

  mock.module("@neondatabase/serverless", { namedExports: { Pool } });
  return issued;
}

let instance = 0;
async function loadDb() {
  process.env.DATABASE_URL = DATABASE_URL;
  return import(`../lib/db.ts?case=${++instance}`);
}

const CAR = "11111111-1111-1111-1111-111111111111";
const PHOTO = "22222222-2222-2222-2222-222222222222";

test("promoting a photo demotes whatever was primary before", async () => {
  const issued = fakePool();
  const { setPrimaryCarPhoto } = await loadDb();
  await setPrimaryCarPhoto(CAR, PHOTO);

  const all = issued.map((q) => q.text).join("\n");
  assert.match(all, /is_primary/, "nothing touched is_primary");
  assert.ok(
    /FALSE|=\s*\(/.test(all),
    "no statement demotes the previous primary; the listing would end up with two",
  );
  mock.reset();
});

test("the promotion is scoped to the listing, not just the photo id", async () => {
  // Without car_id in the predicate, a photo id alone could promote a photo
  // belonging to someone else's listing.
  const issued = fakePool();
  const { setPrimaryCarPhoto } = await loadDb();
  await setPrimaryCarPhoto(CAR, PHOTO);

  for (const q of issued) {
    assert.match(q.text, /car_id/, `statement is not scoped by car_id: ${q.text.slice(0, 80)}`);
  }
  assert.ok(
    issued.some((q) => q.params.includes(CAR)),
    "the car id is never bound as a parameter",
  );
  mock.reset();
});

test("the whole change is one statement, so it cannot half-apply", async () => {
  // Two separate UPDATEs outside a transaction can fail between them, and the
  // first one is the demotion - leaving the listing with no primary at all.
  const issued = fakePool();
  const { setPrimaryCarPhoto } = await loadDb();
  await setPrimaryCarPhoto(CAR, PHOTO);

  const writes = issued.filter((q) => /UPDATE|INSERT|DELETE/i.test(q.text));
  assert.equal(
    writes.length,
    1,
    `expected a single atomic write, got ${writes.length}:\n` +
      writes.map((w) => w.text.replace(/\s+/g, " ").slice(0, 90)).join("\n"),
  );
  mock.reset();
});

test("a photo id that is not in the listing leaves the primary untouched", async () => {
  // The regression this file exists for. The demotion used to be scoped only
  // by "car_id = $1 AND is_primary", so an id belonging to another listing
  // (or no listing) cleared the real primary and promoted nothing, leaving the
  // listing with zero primary photos.
  const issued = fakePool([0]);
  const { setPrimaryCarPhoto } = await loadDb();
  const applied = await setPrimaryCarPhoto(CAR, "33333333-3333-3333-3333-333333333333");

  assert.equal(applied, false, "an unknown photo id must report that nothing was applied");

  const write = issued.find((q) => /UPDATE/i.test(q.text));
  assert.ok(write, "no UPDATE was issued");
  assert.match(
    write.text,
    /EXISTS/i,
    "the update does not verify the target belongs to the listing before demoting the old primary",
  );
  mock.reset();
});

test("a successful promotion reports that it applied", async () => {
  fakePool([1]);
  const { setPrimaryCarPhoto } = await loadDb();
  const applied = await setPrimaryCarPhoto(CAR, PHOTO);

  assert.equal(applied, true);
  mock.reset();
});

test("both ids are bound as parameters, never interpolated", async () => {
  const issued = fakePool();
  const { setPrimaryCarPhoto } = await loadDb();
  await setPrimaryCarPhoto(CAR, PHOTO);

  const write = issued.find((q) => /UPDATE/i.test(q.text));
  assert.ok(write);
  assert.ok(!write.text.includes(CAR), "the car id was interpolated into the SQL text");
  assert.ok(!write.text.includes(PHOTO), "the photo id was interpolated into the SQL text");
  assert.deepEqual([...write.params].sort(), [CAR, PHOTO].sort());
  mock.reset();
});
