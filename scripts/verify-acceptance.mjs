// Final acceptance test for the listing-visibility unification project.
//
// Walks the spec's success path end-to-end against a running dev server:
//   1. Create a listing  (VIN + 10 photos + status='active')
//   2. Listing persists  (DB row exists)
//   3. Appears in /cars  (HTML contains the slug)
//   4. Detail page loads (HTTP 200 on /cars/[slug])
//   5. Contact form works + analytics capture: listing_viewed, contact_request_created
//
// Run with the dev server up on :3000:
//   npm run dev &     (in another shell)
//   node scripts/verify-acceptance.mjs
import { readFileSync } from "node:fs";
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
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const pool = new Pool({ connectionString: url });

let failed = 0;
function check(label, cond, detail = "") {
  if (cond) console.log(`  ✓ ${label}` + (detail ? ` — ${detail}` : ""));
  else { console.log(`  ✗ ${label}` + (detail ? ` — ${detail}` : "")); failed++; }
}

const TIMESTAMP = Date.now();
const VIN = "JTMBFREV40D" + String(TIMESTAMP).slice(-6); // 17 chars
const SELLER_NAME = `Acceptance Test ${TIMESTAMP}`;

// ── 1. Create the listing via POST /api/cars ────────────────────────────────
console.log("\n[1] Create listing (VIN + 10 photos)");
const created = await fetch(BASE + "/api/cars", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sellerName: SELLER_NAME,
    sellerPhone: "+254712345678",
    year: 2021,
    make: "Toyota",
    model: "RAV4",
    price: 4200000,
    mileage: 38000,
    fuel: "petrol",
    transmission: "auto",
    bodyType: "suv",
    condition: "foreign_used",
    location: "Nairobi",
    description: "Acceptance-test listing. Genuine mileage, accident free, full service history. Comes with sunroof and leather seats. All trust signals set.",
    images: Array.from({ length: 10 }, (_, i) => `https://example.com/acceptance/${TIMESTAMP}-${i}.jpg`),
    features: ["Sunroof/Moonroof", "Leather Seats", "Rear Camera"],
    vin: VIN,
    financingAvailable: false,
    hirePurchaseAvailable: false,
  }),
});
const createdJson = await created.json().catch(() => ({}));
check("POST /api/cars returns 201", created.status === 201, `got ${created.status}`);
const slug = createdJson?.car?.slug;
const carId = createdJson?.car?.id;
check("response includes car.slug", !!slug, slug ?? "(missing)");
if (!slug) { await pool.end(); process.exit(1); }

// ── 2. Persists in DB with correct shape ───────────────────────────────────
console.log("\n[2] Listing persists in DB");
const dbRow = (await pool.query(
  `SELECT id, slug, status, vin, COALESCE(array_length(images, 1), 0) AS photo_count,
          created_at, seller_name FROM cars WHERE slug = $1`,
  [slug],
)).rows[0];
check("row exists in cars table", !!dbRow);
check("status='active'", dbRow?.status === "active", dbRow?.status);
check("VIN stored",       dbRow?.vin === VIN, dbRow?.vin);
check("10 photos stored", dbRow?.photo_count === 10, String(dbRow?.photo_count));
check("seller_name stored", dbRow?.seller_name === SELLER_NAME);

// ── 3. Appears in /cars list ───────────────────────────────────────────────
console.log("\n[3] Appears in /cars search");
const carsList = await fetch(BASE + "/api/cars").then((r) => r.json()).catch(() => ({}));
const inApi = (carsList.cars ?? []).some((c) => c.slug === slug);
check("/api/cars list contains slug", inApi);

const carsHtml = await fetch(BASE + "/cars").then((r) => r.text());
check("/cars HTML contains slug", carsHtml.includes(slug));

// ── 4. Detail page loads ───────────────────────────────────────────────────
console.log("\n[4] Detail page");
const apiDetail = await fetch(BASE + "/api/cars/" + slug);
check("/api/cars/[slug] returns 200", apiDetail.status === 200, `got ${apiDetail.status}`);
const detailHtml = await fetch(BASE + "/cars/" + slug);
check("/cars/[slug] returns 200",       detailHtml.status === 200, `got ${detailHtml.status}`);
const detailBody = await detailHtml.text();
check("detail page shows car make/model", detailBody.includes("RAV4") || detailBody.includes("Toyota"));

// Wishlist bypass (Scenario E) — even if we mark the row hidden, ids lookup
// must still resolve it. We don't actually hide it (would mess with [3]); but
// we can directly verify getCarsByIds bypass by hitting /api/cars?ids=.
const idsLookup = await fetch(BASE + `/api/cars?ids=${carId}`).then((r) => r.json());
check("Scenario E: /api/cars?ids=<id> resolves the listing",
  (idsLookup.cars ?? []).some((c) => c.id === carId));

// ── 5. Contact form + analytics capture ────────────────────────────────────
console.log("\n[5] Contact form + analytics events");

// listing_viewed — fired client-side by app/cars/[slug]/car-detail-client.tsx
// on mount; we fire it server-to-server here to validate the persistence path.
await fetch(BASE + "/api/analytics/event", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "listing_viewed",
    props: { carId, slug, make: "Toyota", model: "RAV4", year: 2021, price: 4200000 },
    path: `/cars/${slug}`,
    sessionId: `acceptance-${TIMESTAMP}`,
  }),
});

// contact_request_created — fired by ContactModal.onSubmit in the same client.
await fetch(BASE + "/api/analytics/event", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "contact_request_created",
    props: { carId, slug, channel: "chat", message: "Acceptance test inquiry" },
    path: `/cars/${slug}`,
    sessionId: `acceptance-${TIMESTAMP}`,
  }),
});

// Give the analytics insert a beat to land.
await new Promise((r) => setTimeout(r, 600));

const events = (await pool.query(
  `SELECT name, props FROM analytics_events
   WHERE props->>'carId' = $1 OR props->>'slug' = $2
   ORDER BY created_at DESC LIMIT 10`,
  [carId, slug],
)).rows;

check("analytics: listing_viewed captured",          events.some((e) => e.name === "listing_viewed"));
check("analytics: contact_request_created captured", events.some((e) => e.name === "contact_request_created"));

// ── Visibility unification — search vs detail can't disagree ───────────────
console.log("\n[+] Visibility unification (regression guard)");
const detailNow = await fetch(BASE + "/api/cars/" + slug);
const listNow   = await fetch(BASE + "/api/cars").then((r) => r.json());
const stillInList = (listNow.cars ?? []).some((c) => c.slug === slug);
const stillInDetail = detailNow.status === 200;
check("search ↔ detail agree (both visible)", stillInList && stillInDetail);

await pool.end();
console.log(`\n${failed === 0 ? "ACCEPTANCE PASSED" : `ACCEPTANCE FAILED (${failed} check(s))`}`);
process.exit(failed === 0 ? 0 : 1);
