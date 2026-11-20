// Verifies the vehicle-validation work against a REAL Postgres.
//
// The 33 unit tests exercise the Zod schemas in isolation. They cannot show
// that a validated value survives the insert unchanged, that the database
// refuses what the schema refuses, or that content de-duplication actually
// reads the sha256 rows written at upload time. That is what this does.
//
// Target control is provenance, as in verify-reset.mjs: STAGING_DATABASE_URL
// only, no fallback to DATABASE_URL, and the two must differ. Every row it
// touches is one it created, under a marker it cleans up afterwards.
//
//   node --import ./tests/helpers/register.mjs scripts/staging/verify-listing-validation.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const staging = env.STAGING_DATABASE_URL;
if (!staging) {
  console.error("REFUSED: STAGING_DATABASE_URL is not set. There is no fallback to DATABASE_URL.");
  process.exit(1);
}
if (env.DATABASE_URL && new URL(staging).hostname === new URL(env.DATABASE_URL).hostname) {
  console.error("REFUSED: STAGING_DATABASE_URL points at the same endpoint as DATABASE_URL.");
  process.exit(1);
}
delete process.env.DATABASE_URL;
process.env.DATABASE_URL = staging;

const db = await import("@/lib/db");
const { query, createPublicCar, countDistinctPhotoContent, ListingQualityError } = db;
const { vehicleFieldsSchema } = await import("@/lib/listing-fields");
const { MIN_PUBLISH_PHOTOS } = await import("@/lib/quality-policy");

console.log("target: %s\n", new URL(staging).hostname.split("-pooler")[0]);

const RUN = Date.now().toString(36);
const MARK = `zzval-${RUN}`;
const img = (n) => `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/p${n}.jpg`;
const TEN = Array.from({ length: MIN_PUBLISH_PHOTOS }, (_, i) => img(i));
const VIN = "JTDBR32E630012345";

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log("  PASS  " + label); }
  catch (e) { failures++; console.log("  FAIL  " + label + "\n        " + e.message); }
};
const checkAsync = async (label, fn) => {
  try { await fn(); console.log("  PASS  " + label); }
  catch (e) { failures++; console.log("  FAIL  " + label + "\n        " + e.message); }
};

const carsBefore = (await query("SELECT count(*)::int AS n FROM cars"))[0].n;
const uploadsBefore = (await query("SELECT count(*)::int AS n FROM upload_classifications"))[0].n;

// A real user row to own the listings. Created here, deleted at the end.
const sellerEmail = `${MARK}@staging.invalid`;
const seller = (await query(
  `INSERT INTO users (email, name, provider, email_verified)
   VALUES ($1, 'staging fixture', 'email', TRUE) RETURNING id`,
  [sellerEmail],
))[0];

const VALID = {
  year: 2015, make: "Toyota", model: "Harrier", trim: "Premium",
  price: 2_500_000, mileage: 120_000,
  fuel: "petrol", transmission: "auto", bodyType: "suv",
  condition: "locally_used", location: "Nairobi",
  description: "Well maintained family SUV with full service history, "
    + "new tyres fitted last year and a clean interior throughout.",
  images: TEN, features: [], vin: VIN,
  specifications: { engineCc: 2400, horsepower: 180, seats: 5 },
  previousOwners: 2, exteriorColor: "Pearl White",
  sellerName: "Staging Fixture", sellerPhone: "0712345678", sellerUserId: seller.id,
};

try {
  // ── 1. a valid listing persists, and the stored values are the submitted ones
  console.log("1. valid vehicle creation and persistence\n");

  let created;
  await checkAsync("a valid listing is created", async () => {
    created = await createPublicCar(VALID);
    assert.ok(created?.id, "no row returned");
  });

  await checkAsync("every stored value matches what was submitted", async () => {
    const row = (await query(
      `SELECT year, make, model, trim, price::bigint AS price, mileage,
              fuel, transmission, body_type, condition, location,
              previous_owners, exterior_color, vin, status,
              specifications, images
         FROM cars WHERE id = $1`, [created.id],
    ))[0];
    assert.equal(Number(row.year), VALID.year);
    assert.equal(row.make, VALID.make);
    assert.equal(row.model, VALID.model);
    assert.equal(row.trim, VALID.trim);
    assert.equal(Number(row.price), VALID.price, "price must round-trip exactly");
    assert.equal(Number(row.mileage), VALID.mileage, "mileage must round-trip exactly");
    assert.equal(row.fuel, VALID.fuel);
    assert.equal(row.transmission, VALID.transmission);
    assert.equal(row.body_type, VALID.bodyType);
    assert.equal(row.condition, VALID.condition);
    assert.equal(row.location, VALID.location);
    assert.equal(Number(row.previous_owners), VALID.previousOwners);
    assert.equal(row.exterior_color, VALID.exteriorColor);
    assert.equal(row.vin, VIN, "VIN must be stored normalised");
    assert.equal(row.specifications.engineCc, 2400);
    assert.equal(row.specifications.horsepower, 180);
    assert.equal(row.images.length, MIN_PUBLISH_PHOTOS);
  });

  await checkAsync("the listing is publication-eligible and publicly visible", async () => {
    const row = (await query("SELECT status FROM cars WHERE id = $1", [created.id]))[0];
    assert.equal(row.status, "active", "a complete listing should publish");
    const visible = await query(
      `SELECT 1 FROM cars WHERE id = $1 AND status = 'active'
          AND array_length(images,1) >= $2 AND length(vin) BETWEEN 11 AND 20`,
      [created.id, MIN_PUBLISH_PHOTOS],
    );
    assert.equal(visible.length, 1, "the row does not meet the public visibility policy");
  });

  // ── 2. the database agrees with the schema about what is impossible
  console.log("\n2. what the schema refuses, the database could not have stored\n");

  await checkAsync("1e+18 km would overflow the mileage column", async () => {
    // Proves the ORIGINAL failure mode rather than assuming it: cars.mileage
    // is INTEGER, so without the new bound this reached the driver.
    let code = null;
    try {
      await query(
        `INSERT INTO cars (slug, year, make, model, price, mileage, fuel, transmission,
                           body_type, condition, location, description, images, features)
         VALUES ($1,2015,'Toyota','Harrier',2500000,$2,'petrol','auto','suv',
                 'locally_used','Nairobi','x',ARRAY[]::text[],ARRAY[]::text[])`,
        [`${MARK}-overflow`, 1e18],
      );
    } catch (e) { code = e?.code ?? e?.originalError?.code ?? String(e?.message); }
    assert.ok(code, "the database accepted 1e18 km — the premise is wrong");
    console.log("        (database rejected it with %s)", code);
  });

  await checkAsync("the schema now stops it first, so the driver is never reached", async () => {
    const r = vehicleFieldsSchema.safeParse({ ...VALID, mileage: "1e+18" });
    assert.equal(r.success, false);
  });

  await checkAsync("invalid specifications never reach the row", async () => {
    const r = vehicleFieldsSchema.safeParse({
      ...VALID, specifications: { engineCc: "876567897788898989", horsepower: "87567898765789" },
    });
    assert.equal(r.success, false, "absurd specs must be refused");
    const leaked = await query(
      `SELECT count(*)::int AS n FROM cars
        WHERE (specifications->>'engineCc')::numeric > 20000`,
    );
    assert.equal(leaked[0].n, 0, "a row with an out-of-range engine size exists");
  });

  // ── 3. content de-duplication, against real upload rows
  console.log("\n3. duplicate image CONTENT (sha256 from upload_classifications)\n");

  const sameBytes = "a".repeat(64);
  const variants = [
    `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/front.jpg`,
    `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/copy-of-front.jpg`,
    `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/IMG_4471.png`,
  ];
  for (const url of variants) {
    await query(
      `INSERT INTO upload_classifications (url, sha256, label, provider)
       VALUES ($1,$2,'vehicle','test') ON CONFLICT (url) DO NOTHING`,
      [url, sameBytes],
    );
  }

  await checkAsync("identical content under different public ids counts once", async () => {
    const n = await countDistinctPhotoContent(variants);
    assert.equal(n, 1, `three copies of one file counted as ${n}`);
  });

  await checkAsync("genuinely different content still counts separately", async () => {
    const distinct = [];
    for (let i = 0; i < 3; i++) {
      const url = `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/real-${i}.jpg`;
      await query(
        `INSERT INTO upload_classifications (url, sha256, label, provider)
         VALUES ($1,$2,'vehicle','test') ON CONFLICT (url) DO NOTHING`,
        [url, String(i).repeat(64)],
      );
      distinct.push(url);
    }
    assert.equal(await countDistinctPhotoContent(distinct), 3);
  });

  await checkAsync("a URL with no recorded hash is not discarded", async () => {
    // Hashes are only written for images that went through the vehicle-photo
    // path, so an unhashed URL is normal and must still count.
    const mixed = [...variants, `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/nohash.jpg`];
    assert.equal(await countDistinctPhotoContent(mixed), 2, "1 duplicate group + 1 unhashed");
  });

  await checkAsync("ten copies of one photograph cannot publish a listing", async () => {
    const ten = [];
    for (let i = 0; i < MIN_PUBLISH_PHOTOS; i++) {
      const url = `https://res.cloudinary.com/demo/image/upload/v1/${MARK}/dup-${i}.jpg`;
      await query(
        `INSERT INTO upload_classifications (url, sha256, label, provider)
         VALUES ($1,$2,'vehicle','test') ON CONFLICT (url) DO NOTHING`,
        [url, "f".repeat(64)],           // same bytes, ten different public ids
      );
      ten.push(url);
    }
    assert.equal(await countDistinctPhotoContent(ten), 1, "content check failed");

    let threw = null;
    try {
      await createPublicCar({ ...VALID, images: ten, sellerUserId: seller.id });
    } catch (e) { threw = e; }
    assert.ok(threw, "a listing with ten copies of one photo was published");
    assert.ok(
      threw instanceof ListingQualityError || /photos/i.test(threw.message),
      `unexpected error: ${threw.message}`,
    );
    console.log("        (refused: %s)", threw.message.slice(0, 96));
  });

  // ── 4. the publish gate is enforced at the database layer, not the form
  console.log("\n4. publication gate\n");

  await checkAsync("too few photos is refused even with everything else valid", async () => {
    let threw = null;
    try { await createPublicCar({ ...VALID, images: TEN.slice(0, 3) }); }
    catch (e) { threw = e; }
    assert.ok(threw, "a 3-photo listing published");
  });

  await checkAsync("a missing VIN is refused at publish time", async () => {
    let threw = null;
    try { await createPublicCar({ ...VALID, vin: null }); }
    catch (e) { threw = e; }
    assert.ok(threw, "a listing with no VIN published");
  });

  await checkAsync("no partial rows were left behind by the refusals", async () => {
    const n = (await query(
      "SELECT count(*)::int AS n FROM cars WHERE slug LIKE $1", [`%${MARK}%`],
    ))[0].n;
    assert.equal(n, 0, `${n} rows leaked from refused publishes`);
  });
} finally {
  console.log("\ncleanup\n");
  const cars = await query(
    `DELETE FROM cars WHERE seller_user_id = $1 OR slug LIKE $2 RETURNING id`,
    [seller.id, `%${MARK}%`],
  );
  const ups = await query(
    "DELETE FROM upload_classifications WHERE url LIKE $1 RETURNING url", [`%${MARK}%`],
  );
  await query("DELETE FROM users WHERE email = $1", [sellerEmail]);
  const carsAfter = (await query("SELECT count(*)::int AS n FROM cars"))[0].n;
  const uploadsAfter = (await query("SELECT count(*)::int AS n FROM upload_classifications"))[0].n;
  console.log("  removed %d cars, %d upload rows, 1 user", cars.length, ups.length);
  console.log("  cars %d -> %d, upload_classifications %d -> %d",
    carsBefore, carsAfter, uploadsBefore, uploadsAfter);
  if (carsAfter !== carsBefore || uploadsAfter !== uploadsBefore) {
    console.log("  WARNING: counts did not return to baseline");
    failures++;
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
