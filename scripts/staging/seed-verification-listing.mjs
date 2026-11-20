// Option B: creates ONE clearly identifiable staging-only listing through the
// real createPublicCar pathway, then verifies persistence, ownership and
// buyer-facing visibility.
//
// WHAT THIS DOES NOT DO: it reuses image URLs already present in the staging
// database. No file is uploaded. The real Cloudinary upload path — multipart
// handling, size and MIME checks, magic-byte sniffing, the quality
// classifier, sha256 recording — is NOT exercised here and must not be
// reported as passing.
//
// Target control is provenance: STAGING_DATABASE_URL only, no fallback.
//
//   node --import ./tests/helpers/register.mjs scripts/staging/seed-verification-listing.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const staging = env.STAGING_DATABASE_URL;
if (!staging) { console.error("REFUSED: STAGING_DATABASE_URL not set."); process.exit(1); }
if (env.DATABASE_URL && new URL(staging).hostname === new URL(env.DATABASE_URL).hostname) {
  console.error("REFUSED: same endpoint as DATABASE_URL."); process.exit(1);
}
delete process.env.DATABASE_URL;
process.env.DATABASE_URL = staging;

const { query, createPublicCar, assertImagesOwnedBy, ListingQualityError } = await import("@/lib/db");
const { MIN_PUBLISH_PHOTOS } = await import("@/lib/quality-policy");

let failures = 0;
const check = async (label, fn) => {
  try { await fn(); console.log("  PASS  " + label); }
  catch (e) { failures++; console.log("  FAIL  " + label + "\n        " + e.message); }
};

console.log("target: %s\n", new URL(staging).hostname.split("-pooler")[0]);

// ── existing image URLs already in staging ────────────────────────────────
const sources = await query(
  `SELECT images FROM cars WHERE array_length(images, 1) >= $1 LIMIT 1`, [MIN_PUBLISH_PHOTOS],
);
if (sources.length === 0) { console.error("No existing listing has enough images to reuse."); process.exit(1); }
const images = sources[0].images.slice(0, MIN_PUBLISH_PHOTOS);
console.log("reusing %d existing staging image URLs (no upload performed)\n", images.length);

// ── a clearly identifiable owner ──────────────────────────────────────────
const EMAIL = "zz-staging-verification@staging.invalid";
await query(`DELETE FROM cars WHERE seller_user_id IN (SELECT id FROM users WHERE email = $1)`, [EMAIL]);
await query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
const owner = (await query(
  `INSERT INTO users (email, name, provider, email_verified, role)
   VALUES ($1, 'ZZ Staging Verification', 'email', TRUE, 'buyer') RETURNING id`, [EMAIL],
))[0];

const carsBefore = (await query("SELECT count(*)::int AS n FROM cars"))[0].n;
const othersBefore = await query(
  `SELECT id, slug, status, updated_at FROM cars ORDER BY created_at`,
);

const LISTING = {
  year: 2016, make: "Toyota", model: "Harrier", trim: "Premium",
  price: 2_750_000, mileage: 96_500,
  fuel: "petrol", transmission: "auto", bodyType: "suv",
  condition: "foreign_used", location: "Nairobi",
  description:
    "STAGING VERIFICATION LISTING — not a real vehicle. Created to verify listing "
    + "persistence and buyer-facing display on the staging branch. Imported 2016 Harrier "
    + "with full service history and a clean interior throughout.",
  images, features: ["Sunroof", "Reverse camera"],
  financingAvailable: false, hirePurchaseAvailable: false,
  vin: "JTDBR32E630099999",
  specifications: { engineCc: 2000, horsepower: 151, seats: 5, source: "manual" },
  previousOwners: 1, exteriorColor: "Pearl White", interiorColor: "Black",
  sellerName: "ZZ Staging Verification", sellerPhone: "0700000000",
  sellerUserId: owner.id,
};

console.log("1. creation and persistence\n");
let car;
await check("the listing is created through createPublicCar", async () => {
  car = await createPublicCar(LISTING);
  assert.ok(car?.id);
});

let row;
await check("stored values match what was submitted", async () => {
  row = (await query(
    `SELECT id, slug, status, seller_user_id, seller_name, seller_phone, year, make, model,
            trim, price::bigint AS price, mileage, fuel, transmission, body_type, condition,
            location, vin, previous_owners, exterior_color, interior_color, images,
            specifications, verified, vin_verified, created_at
       FROM cars WHERE id = $1`, [car.id],
  ))[0];
  assert.equal(Number(row.year), LISTING.year);
  assert.equal(row.make, LISTING.make);
  assert.equal(row.model, LISTING.model);
  assert.equal(row.trim, LISTING.trim);
  assert.equal(Number(row.price), LISTING.price);
  assert.equal(Number(row.mileage), LISTING.mileage);
  assert.equal(row.body_type, LISTING.bodyType);
  assert.equal(row.condition, LISTING.condition);
  assert.equal(row.vin, LISTING.vin);
  assert.equal(Number(row.previous_owners), 1);
  assert.equal(row.exterior_color, "Pearl White");
  assert.equal(row.images.length, MIN_PUBLISH_PHOTOS);
  assert.equal(row.specifications.engineCc, 2000);
});

await check("seller ownership is correct", async () => {
  assert.equal(row.seller_user_id, owner.id, "seller_user_id must be the creating account");
  assert.equal(row.seller_name, "ZZ Staging Verification");
  const joined = (await query(
    `SELECT u.email FROM cars c JOIN users u ON u.id = c.seller_user_id WHERE c.id = $1`, [car.id],
  ))[0];
  assert.equal(joined.email, EMAIL, "the ownership join must resolve to the test account");
});

await check("verification flags are NOT set by creation", async () => {
  // Task 2: only a completed verification process may set these.
  assert.equal(row.verified, false, "a newly created listing must not be independently verified");
  assert.ok(row.vin_verified === false || row.vin_verified === null,
    "the seller declared nothing, so the claim flag must be unset");
});

console.log("\n2. publication and buyer-facing visibility\n");

await check("status is active and publication-eligible", async () => {
  assert.equal(row.status, "active");
  const visible = await query(
    `SELECT 1 FROM cars WHERE id = $1 AND status = 'active'
        AND array_length(images,1) >= $2 AND length(vin) BETWEEN 11 AND 20`,
    [car.id, MIN_PUBLISH_PHOTOS],
  );
  assert.equal(visible.length, 1, "the row does not meet the public visibility policy");
});

await check("it appears in the buyer-facing listing query", async () => {
  const { getPublicCars } = await import("@/lib/db");
  const res = await getPublicCars({});
  const list = Array.isArray(res) ? res : (res.cars ?? res.items ?? []);
  assert.ok(list.some((c) => c.id === car.id), "the listing is not returned to buyers");
});

console.log("\n3. image ownership guard (Finding B), against the real database\n");

await check("another account's image cannot be attached", async () => {
  const foreignUrl = `https://res.cloudinary.com/demo/image/upload/v1/zzforeign/${Date.now()}.jpg`;
  const other = (await query(
    `INSERT INTO users (email, name, provider, email_verified)
     VALUES ($1,'ZZ Other','email',TRUE) RETURNING id`, [`zz-other-${Date.now()}@staging.invalid`],
  ))[0];
  await query(
    `INSERT INTO upload_classifications (url, sha256, label, provider, user_id)
     VALUES ($1,$2,'vehicle','test',$3)`, [foreignUrl, "c".repeat(64), other.id],
  );
  let threw = null;
  try { await assertImagesOwnedBy(owner.id, [...images.slice(0, 9), foreignUrl]); }
  catch (e) { threw = e; }
  await query(`DELETE FROM upload_classifications WHERE url = $1`, [foreignUrl]);
  await query(`DELETE FROM users WHERE id = $1`, [other.id]);

  assert.ok(threw, "a photo uploaded by another account was accepted");
  assert.ok(threw instanceof ListingQualityError, `unexpected error type: ${threw?.name}`);
  console.log("        (refused: %s)", threw.message.slice(0, 90));
});

await check("the seller's own images are still accepted", async () => {
  await assertImagesOwnedBy(owner.id, images); // must not throw
});

console.log("\n4. no collateral change to existing records\n");

await check("pre-existing listings are untouched", async () => {
  const after = await query(`SELECT id, slug, status, updated_at FROM cars ORDER BY created_at`);
  for (const before of othersBefore) {
    const now = after.find((r) => r.id === before.id);
    assert.ok(now, `existing listing ${before.slug} disappeared`);
    assert.equal(now.status, before.status, `${before.slug} changed status`);
    assert.equal(String(now.updated_at), String(before.updated_at), `${before.slug} was modified`);
  }
  assert.equal(after.length, carsBefore + 1, "unexpected number of listings");
});

const final = (await query(
  `SELECT id, slug, status, created_at FROM cars WHERE id = $1`, [car.id],
))[0];

console.log("\n" + "=".repeat(68));
console.log("STAGING TEST LISTING — RETAINED, NOT DELETED");
console.log("=".repeat(68));
console.log("  database id : %s", final.id);
console.log("  slug        : %s", final.slug);
console.log("  status      : %s", final.status);
console.log("  created_at  : %s", final.created_at);
console.log("  owner email : %s", EMAIL);
console.log("  owner id    : %s", owner.id);
console.log("  url         : http://localhost:3000/cars/%s", final.slug);
console.log("=".repeat(68));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
