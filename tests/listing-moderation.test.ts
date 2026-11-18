import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkPublishRequirements, explainRefusal } from "../lib/publish-requirements.ts";

// Tests for administrator suspension, safe reinstatement and the
// authorization around them.
//
// The handlers are called DIRECTLY with mocked dependencies. Testing that a
// button is hidden proves nothing: the question is what happens when someone
// posts to the endpoint themselves, which is exactly what an attacker does.

const ADMIN_ROUTE = "app/api/admin/cars/[id]/route.ts";
const AUTH_URL = new URL("../auth.ts", import.meta.url).href;
const DB_URL = new URL("../lib/db.ts", import.meta.url).href;
const LOGGER_URL = new URL("../lib/admin-logger.ts", import.meta.url).href;

const CAR_ID = "11111111-1111-1111-1111-111111111111";

/** A listing that satisfies every publication requirement. */
const COMPLIANT = {
  id: CAR_ID,
  slug: "2018-mazda-cx5-abc12",
  status: "suspended" as string,
  description:
    "Selling my 2018 Mazda CX-5. Locally used, 78,000 km, full service history at the dealer. " +
    "Accident free with a clean logbook. New tyres fitted last month.",
  vin: "JM3KE2BE1E0123456",
  images: Array.from({ length: 10 }, (_, i) => `https://res.cloudinary.com/x/image/upload/v1/p${i}.jpg`),
  sellerUserId: "seller-1",
};

let instance = 0;

interface MockOpts {
  session: unknown;
  car?: Record<string, unknown> | null;
  photos?: { status: string }[];
  onModerate?: (args: unknown[]) => void;
  onAudit?: (entry: Record<string, unknown>) => void;
}

/**
 * Mocks auth, lib/db and the audit logger for the admin route.
 *
 * lib/db is spread from the real module rather than hand-stubbed: mocking a
 * module replaces it for every importer, so a partial stub breaks whatever
 * the route's transitive dependencies import from it.
 */
async function mockRoute(
  t: { mock: { module: (u: string, o: unknown) => void } },
  opts: MockOpts,
) {
  t.mock.module(AUTH_URL, { namedExports: { auth: async () => opts.session } });

  const realDb = await import("../lib/db.ts");
  t.mock.module(DB_URL, {
    namedExports: {
      ...realDb,
      getCarByIdAdmin: async () => (opts.car === undefined ? COMPLIANT : opts.car),
      listCarPhotos: async () => opts.photos ?? [],
      adminModerateCar: async (...args: unknown[]) => { opts.onModerate?.(args); },
      adminDeleteCar: async () => {},
    },
  });

  t.mock.module(LOGGER_URL, {
    namedExports: {
      auditLog: async (entry: Record<string, unknown>) => { opts.onAudit?.(entry); },
    },
  });

  return import(`../app/api/admin/cars/[id]/route.ts?case=${++instance}`);
}

function patch(body: unknown) {
  return [
    new Request(`http://localhost/api/admin/cars/${CAR_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: CAR_ID }) },
  ] as const;
}

const ADMIN = { user: { id: "admin-1", email: "admin@example.com", role: "admin" } };
const SELLER = { user: { id: "seller-1", email: "seller@example.com", role: "private_seller" } };
const OTHER_SELLER = { user: { id: "seller-2", email: "other@example.com", role: "private_seller" } };

// ---------------------- authorization ----------------------

test("an unauthenticated caller cannot change a listing's status", async (t) => {
  let moderated = false;
  const { PATCH } = await mockRoute(t, { session: null, onModerate: () => { moderated = true; } });
  const res = await PATCH(...patch({ status: "suspended", reason: "spam" }));

  assert.equal(res.status, 403);
  assert.equal(moderated, false, "the status must not have been written");
});

test("a seller cannot suspend their own listing", async (t) => {
  // Even the owner must not hold the suspension lever: it is an
  // administrative action, not an ownership one.
  let moderated = false;
  const { PATCH } = await mockRoute(t, { session: SELLER, onModerate: () => { moderated = true; } });
  const res = await PATCH(...patch({ status: "suspended", reason: "whatever" }));

  assert.equal(res.status, 403);
  assert.equal(moderated, false);
});

test("a seller cannot suspend someone else's listing", async (t) => {
  let moderated = false;
  const { PATCH } = await mockRoute(t, { session: OTHER_SELLER, onModerate: () => { moderated = true; } });
  const res = await PATCH(...patch({ status: "suspended", reason: "competitor" }));

  assert.equal(res.status, 403);
  assert.equal(moderated, false);
});

test("a seller cannot reinstate their own suspended listing", async (t) => {
  let moderated = false;
  const { PATCH } = await mockRoute(t, { session: SELLER, onModerate: () => { moderated = true; } });
  const res = await PATCH(...patch({ status: "active" }));

  assert.equal(res.status, 403);
  assert.equal(moderated, false, "a seller must not be able to lift their own suspension");
});

test("a forged role in the request body is ignored", async (t) => {
  // The role comes from the server-side session, never the payload.
  let moderated = false;
  const { PATCH } = await mockRoute(t, { session: SELLER, onModerate: () => { moderated = true; } });
  const res = await PATCH(...patch({ status: "active", role: "admin", isAdmin: true, adminId: "admin-1" }));

  assert.equal(res.status, 403);
  assert.equal(moderated, false);
});

// ---------------------- suspension ----------------------

test("an admin can suspend a listing, and the reason is persisted", async (t) => {
  const calls: unknown[][] = [];
  const audits: Record<string, unknown>[] = [];
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    car: { ...COMPLIANT, status: "active" },
    onModerate: (a) => calls.push(a),
    onAudit: (e) => audits.push(e),
  });

  const res = await PATCH(...patch({ status: "suspended", reason: "Odometer looks tampered with" }));
  assert.equal(res.status, 200);

  assert.equal(calls.length, 1, "the status must be written exactly once");
  const [carId, adminId, status, reason] = calls[0] as [string, string, string, string];
  assert.equal(carId, CAR_ID);
  assert.equal(adminId, "admin-1", "the administrator identity comes from the session");
  assert.equal(status, "suspended");
  assert.equal(reason, "Odometer looks tampered with");

  const entry = audits.find((a) => a.action === "listing_suspend");
  assert.ok(entry, `expected a listing_suspend audit entry, got ${audits.map((a) => a.action).join(", ")}`);
  assert.equal(entry.targetType, "car");
  assert.equal(entry.targetId, CAR_ID);
});

test("suspension requires a reason", async (t) => {
  let moderated = false;
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    car: { ...COMPLIANT, status: "active" },
    onModerate: () => { moderated = true; },
  });

  const res = await PATCH(...patch({ status: "suspended" }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /requires a reason/i);
  assert.equal(moderated, false);
});

// ---------------------- safe reinstatement ----------------------

test("reinstatement is refused when publication requirements are unmet, and the listing stays suspended", async (t) => {
  const calls: unknown[][] = [];
  const audits: Record<string, unknown>[] = [];
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    // Suspended precisely because it is deficient: mashed description, no VIN,
    // and only three photos.
    car: {
      ...COMPLIANT,
      status: "suspended",
      description: "uhygby7gbygb y hgbyt67tg gy76ygt6tyg",
      vin: null,
      images: ["a.jpg", "b.jpg", "c.jpg"],
    },
    photos: [{ status: "approved" }, { status: "approved" }, { status: "pending" }],
    onModerate: (a) => calls.push(a),
    onAudit: (e) => audits.push(e),
  });

  const res = await PATCH(...patch({ status: "active" }));

  assert.equal(res.status, 409, "a refused reinstatement must not report success");
  const body = await res.json();
  assert.equal(body.code, "publish_requirements_unmet");
  assert.equal(body.status, "suspended", "the response must report the unchanged status");
  assert.ok(body.failures.length >= 3, `expected every failure, got ${JSON.stringify(body.failures)}`);
  assert.ok(body.failures.some((f: string) => /description/i.test(f)));
  assert.ok(body.failures.some((f: string) => /photo/i.test(f)));
  assert.ok(body.failures.some((f: string) => /VIN|chassis/i.test(f)));

  assert.equal(calls.length, 0, "THE LISTING MUST REMAIN SUSPENDED - no status write may occur");

  const refusal = audits.find((a) => a.action === "listing_reinstate_refused");
  assert.ok(refusal, "a refused reinstatement is itself an auditable event");
});

test("a compliant listing is reinstated and audited as a reinstatement", async (t) => {
  const calls: unknown[][] = [];
  const audits: Record<string, unknown>[] = [];
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    car: { ...COMPLIANT, status: "suspended" },
    photos: Array.from({ length: 10 }, () => ({ status: "approved" })),
    onModerate: (a) => calls.push(a),
    onAudit: (e) => audits.push(e),
  });

  const res = await PATCH(...patch({ status: "active" }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as string[])[2], "active");

  assert.ok(
    audits.some((a) => a.action === "listing_reinstate"),
    "coming back from a suspension is a reinstatement, not a first approval",
  );
});

test("reinstatement is refused when photos exist but too few are approved", async (t) => {
  // Enough photos attached, but a moderator has only cleared two of them.
  // Publishing on the raw count would put unreviewed images live.
  const calls: unknown[][] = [];
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    car: { ...COMPLIANT, status: "suspended" },
    photos: [
      ...Array.from({ length: 2 }, () => ({ status: "approved" })),
      ...Array.from({ length: 8 }, () => ({ status: "pending" })),
    ],
    onModerate: (a) => calls.push(a),
  });

  const res = await PATCH(...patch({ status: "active" }));
  assert.equal(res.status, 409);
  assert.match((await res.json()).failures.join(" "), /passed moderation/i);
  assert.equal(calls.length, 0);
});

test("a listing already active is not re-checked, so ordinary edits are unaffected", async (t) => {
  // The gate applies to transitions INTO public view. Re-approving a listing
  // that is already live must not start failing because a rule tightened.
  const calls: unknown[][] = [];
  const { PATCH } = await mockRoute(t, {
    session: ADMIN,
    car: { ...COMPLIANT, status: "active", description: "short", vin: null, images: [] },
    onModerate: (a) => calls.push(a),
  });

  const res = await PATCH(...patch({ status: "active" }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

// ---------------------- the requirement check itself ----------------------

test("checkPublishRequirements reports every failure at once", () => {
  const check = checkPublishRequirements({
    description: "uhygby7gbygb y hgbyt67tg gy76ygt6tyg",
    vin: null,
    photoCount: 2,
  });
  assert.equal(check.ok, false);
  assert.equal(check.failures.length, 3, JSON.stringify(check.failures));
  assert.match(explainRefusal(check), /cannot be published yet/);
});

test("a fully compliant listing passes the check", () => {
  const check = checkPublishRequirements({
    description: COMPLIANT.description,
    vin: COMPLIANT.vin,
    photoCount: 10,
    approvedPhotoCount: 10,
  });
  assert.deepEqual(check.failures, []);
  assert.equal(check.ok, true);
});

test("a listing without per-photo records is judged on its total, not punished", () => {
  // Rows predating car_photos have no per-photo moderation state. Treating
  // that absence as "zero approved" would make every legacy listing
  // unreinstatable.
  const check = checkPublishRequirements({
    description: COMPLIANT.description,
    vin: COMPLIANT.vin,
    photoCount: 10,
    approvedPhotoCount: null,
  });
  assert.equal(check.ok, true);
});

test("a description still awaiting review blocks publication", () => {
  const check = checkPublishRequirements({
    description: "jhgfdsa kjhgfds lkjhgfd mnbvcxz poiuytr",
    vin: COMPLIANT.vin,
    photoCount: 10,
    approvedPhotoCount: 10,
  });
  assert.equal(check.ok, false);
  assert.ok(check.failures.some((f) => /description/i.test(f)));
});

// ---------------------- wiring assertions ----------------------

test("suspension is a real status reachable through the admin API", () => {
  const src = readFileSync(ADMIN_ROUTE, "utf8");
  assert.match(src, /suspended:\s*"listing_suspend"/, "the API must accept the suspended transition");
  assert.match(src, /REASON_REQUIRED/, "suspension and rejection must both require a reason");

  const types = readFileSync("types/index.ts", "utf8");
  assert.match(types, /"suspended"/);

  const admin = readFileSync("app/admin/cars/page.tsx", "utf8");
  assert.match(admin, /suspended/, "an admin must be able to filter to suspended listings");
});

test("suspended listings are excluded from public view by the shared visibility rule", () => {
  // No per-status exclusion list is needed: public queries allow only
  // 'active', so every other status is out of public view by construction.
  const src = readFileSync("lib/db.ts", "utf8");
  assert.match(src, /\$\{alias\}\.status = 'active'/);
});

test("enquiries cannot be created against a listing that is not active", () => {
  const src = readFileSync("lib/leads.ts", "utf8");
  assert.match(
    src,
    /WHERE c\.id = \$1 AND c\.status = 'active'/,
    "createLead looked a car up by id alone, so a suspended listing still took enquiries",
  );
});

test("the dealer publication path validates descriptions and assigns status explicitly", () => {
  const src = readFileSync("app/api/dealer/listings/route.ts", "utf8");
  assert.match(src, /assessDescription\(body\?\.description\)/);
  assert.match(src, /description_rejected/);
  assert.match(src, /"pending_review"/, "an uncertain description must not reach 'active'");
  assert.ok(
    !/createDealerCar\(dealer\.id, body\)/.test(src),
    "the raw body is being passed through again, bypassing the status decision",
  );
});

test("status counts come from the database, not a hand-maintained list", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  assert.match(
    src,
    /SELECT status, COUNT\(\*\)::TEXT AS count FROM cars GROUP BY status/,
    "counts must be a GROUP BY over the real table so they cannot drift from it",
  );
});

test("an administratively removed listing is not resurfaced by wishlist or recently-viewed", () => {
  // Found by actually suspending a listing in the admin panel: it vanished
  // from search, but was still listed under "Recently viewed".
  //
  // getCarsByIds is deliberately exempt from the public visibility helper, so
  // a car you saved does not silently disappear while the SELLER has it
  // hidden, as a draft, pending review or sold. That exemption was written as
  // "any status", which also covered administrative takedowns — so a listing
  // suspended for fraud remained reachable from a viewer's own lists, which
  // is precisely what suspension exists to prevent.
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function getCarsByIds"));
  const query = fn.slice(0, fn.indexOf("`,"));

  assert.match(
    query,
    /c\.status <> ALL\(ARRAY\['suspended','rejected','archived'\]\)/,
    "getCarsByIds must exclude administrative takedowns",
  );

  for (const takedown of ["suspended", "rejected", "archived"]) {
    assert.ok(query.includes(`'${takedown}'`), `${takedown} must be excluded`);
  }

  // The seller-controlled states stay visible to the person who saved them:
  // narrowing the exemption must not become a blanket status filter.
  for (const sellerControlled of ["hidden", "draft", "pending_review", "sold"]) {
    assert.ok(
      !query.includes(`'${sellerControlled}'`),
      `${sellerControlled} is seller-controlled and must remain resolvable in a saved list`,
    );
  }
});
