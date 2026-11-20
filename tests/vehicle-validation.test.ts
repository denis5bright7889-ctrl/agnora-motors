import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { readFileSync } from "node:fs";
import {
  VEHICLE_LIMITS, MIN_YEAR, maxYear, toFiniteNumber,
  boundedNumber, optionalBoundedNumber, yearSchema,
  isDisplayableNumber, formatIfValid,
} from "../lib/vehicle-limits.ts";
import { assessVehicleName, modelSchema, trimSchema, colourSchema, makeSchema, isKnownMake } from "../lib/model-name.ts";
import { distinctPhotoCount, photoIdentity, MIN_PUBLISH_PHOTOS } from "../lib/quality-policy.ts";
import { vehicleFieldsSchema } from "../lib/listing-fields.ts";

// Regression tests for the values actually reported from the Sell Your Car
// workflow. Each one is pinned by name so a future change that re-opens the
// hole fails loudly rather than quietly.

const REPORTED = {
  model:          "iuytfgh7",
  trim:           "987t67ftcghj",
  mileage:        "1e+18",
  engineCc:       "876567897788898989",
  horsepower:     "87567898765789",
  torqueNm:       "89765789876",
  previousOwners: "76678658687",
};

// ── 1. the exact reported values ───────────────────────────────────────────

test("every value from the bug report is now refused", () => {
  const mileage = boundedNumber("mileageKm");
  const cc      = optionalBoundedNumber("engineCc");
  const hp      = optionalBoundedNumber("horsepower");
  const nm      = optionalBoundedNumber("torqueNm");
  const owners  = optionalBoundedNumber("previousOwners");

  assert.equal(mileage.safeParse(REPORTED.mileage).success, false, "mileage 1e+18 must be refused");
  assert.equal(cc.safeParse(REPORTED.engineCc).success, false, "engine capacity must be refused");
  assert.equal(hp.safeParse(REPORTED.horsepower).success, false, "horsepower must be refused");
  assert.equal(nm.safeParse(REPORTED.torqueNm).success, false, "torque must be refused");
  assert.equal(owners.safeParse(REPORTED.previousOwners).success, false, "owner count must be refused");
  assert.equal(modelSchema().safeParse(REPORTED.model).success, false, "model must be refused");
  assert.equal(trimSchema().safeParse(REPORTED.trim).success, false, "trim must be refused");
});

test("the old mileage rule really did accept 1e+18 — the premise of this fix", () => {
  // Pins the cause so nobody "simplifies" back to it. z.coerce.number().min(0)
  // is a valid, positive, finite number for 1e18, and there was no maximum.
  const old = z.coerce.number().min(0);
  assert.equal(old.safeParse("1e+18").success, true);
  assert.equal(old.safeParse(Infinity).success, true, "Infinity passes z.number() too");
});

// ── 2. numeric safety ──────────────────────────────────────────────────────

test("NaN, Infinity and unsafe integers never become numbers", () => {
  for (const bad of [NaN, Infinity, -Infinity, "abc", "NaN", "Infinity", {}, [], true]) {
    assert.equal(toFiniteNumber(bad), undefined, `${String(bad)} must not convert`);
  }
  assert.equal(toFiniteNumber(Number.MAX_SAFE_INTEGER + 2), undefined, "beyond 2^53 is not exact");
});

test("blank means absent, not zero", () => {
  // Number("") is 0. A blank mileage box must not be stored as a genuine 0 km.
  assert.equal(toFiniteNumber(""), undefined);
  assert.equal(toFiniteNumber(null), undefined);
  assert.equal(boundedNumber("mileageKm").safeParse("").success, false, "blank mileage is not 0 km");
});

test("scientific notation is judged on value, not on spelling", () => {
  const mileage = boundedNumber("mileageKm");
  assert.equal(mileage.safeParse("1e3").success, true, "1e3 is just 1000 km");
  assert.equal(mileage.safeParse("1.2e5").success, true, "120,000 km is ordinary");
  assert.equal(mileage.safeParse("1e+18").success, false, "10^18 km is not");
});

test("negative values are refused where they make no sense", () => {
  for (const key of ["mileageKm", "priceKsh", "engineCc", "horsepower", "previousOwners"] as const) {
    const schema = optionalBoundedNumber(key);
    assert.equal(schema.safeParse(-1).success, false, `${key} must refuse -1`);
  }
});

test("a non-numeric optional field fails instead of silently vanishing", () => {
  // Dropping it would publish a listing that ignored what the seller typed.
  const hp = optionalBoundedNumber("horsepower");
  assert.equal(hp.safeParse("abc").success, false);
  assert.equal(hp.safeParse(undefined).success, true, "genuinely absent is fine");
  assert.equal(hp.safeParse("").success, true, "blank is absent");
});

test("integer fields refuse fractions, decimal fields allow them", () => {
  assert.equal(optionalBoundedNumber("seats").safeParse(4.5).success, false, "4.5 seats");
  assert.equal(optionalBoundedNumber("fuelEconomyKmL").safeParse(14.5).success, true);
});

test("the mileage ceiling stays inside what Postgres can store", () => {
  // cars.mileage is INTEGER. A bound above 2,147,483,647 would reintroduce
  // the original failure: valid to Zod, fatal at the driver.
  assert.ok(
    VEHICLE_LIMITS.mileageKm.max < 2_147_483_647,
    "mileage limit must stay under the INTEGER ceiling",
  );
});

test("boundary values are inclusive on both ends", () => {
  const m = boundedNumber("mileageKm");
  assert.equal(m.safeParse(0).success, true);
  assert.equal(m.safeParse(VEHICLE_LIMITS.mileageKm.max).success, true);
  assert.equal(m.safeParse(VEHICLE_LIMITS.mileageKm.max + 1).success, false);
});

test("the model-year ceiling does not go stale", () => {
  // It was the literal 2026, which becomes wrong on 1 January.
  const schema = yearSchema(new Date("2031-03-04T00:00:00Z"));
  assert.equal(schema.safeParse(2031).success, true);
  assert.equal(schema.safeParse(2032).success, true, "next year, for early arrivals");
  assert.equal(schema.safeParse(2033).success, false);
  assert.equal(schema.safeParse(MIN_YEAR - 1).success, false);
  assert.equal(maxYear(new Date("2031-01-01T00:00:00Z")), 2032);
});

// ── 3. text plausibility, without rejecting real cars ──────────────────────

test("keyboard mashing is rejected", () => {
  for (const bad of ["iuytfgh7", "asdfghjk", "qwertyui", "poiuytre", "zxcvbn asdfg"]) {
    assert.equal(
      assessVehicleName(bad).verdict, "reject",
      `${bad} should read as keyboard input`,
    );
  }
  assert.equal(assessVehicleName("iuytfgh7").rule, "keyboard_run");
});

test("long vowel-less strings are rejected", () => {
  assert.equal(assessVehicleName("987t67ftcghj").verdict, "reject");
  assert.equal(assessVehicleName("987t67ftcghj").rule, "no_vowels");
});

test("legitimate and unusual model names are NOT rejected", () => {
  // The guard rail for the whole approach: these are real vehicles, several
  // of them consonant clusters or alphanumeric codes. Any rule that trips on
  // one of these is too aggressive and must be loosened, not this list.
  const real = [
    "CX-5", "GT-R", "MX-5", "CR-V", "XC90", "RAV4", "bZ4X", "X5", "i30", "Q7",
    "e-tron", "Vitz", "Axela", "Harrier", "Hilux", "Note", "Fit", "Demio",
    "Mark X", "Land Cruiser Prado", "911", "A-Class", "C 200", "E 350 d",
    "Civic Type R", "Corolla Fielder", "Probox", "Succeed", "Wish", "Noah",
    "BRZ", "SLK", "GLC", "CLS", "TT", "NX", "Ractis", "Sienta", "Passo",
    "Range Rover Evoque", "Grand Cherokee", "Outlander PHEV", "Leaf", "Aqua",
  ];
  for (const name of real) {
    const a = assessVehicleName(name);
    assert.equal(a.verdict, "ok", `"${name}" is a real model and must be accepted (rule: ${a.rule})`);
  }
});

test("trim stays optional but must be plausible when given", () => {
  assert.equal(trimSchema().safeParse(undefined).success, true, "trim may be omitted");
  assert.equal(trimSchema().safeParse("").success, true, "blank trim is fine");
  assert.equal(trimSchema().safeParse("2.0 TDI S line").success, true);
  assert.equal(trimSchema().safeParse("987t67ftcghj").success, false);
});

test("empty and overlong names are refused", () => {
  assert.equal(modelSchema().safeParse("").success, false);
  assert.equal(modelSchema().safeParse("   ").success, false, "whitespace is not a model");
  assert.equal(modelSchema().safeParse("x".repeat(61)).success, false);
});

test("repeated-character runs are refused", () => {
  assert.equal(assessVehicleName("Coroaaaalla").rule, "repeated_char");
  assert.equal(assessVehicleName("Corolla").verdict, "ok", "three or fewer is left alone");
});

test("colour fields reject mashing but allow marketing names", () => {
  const c = colourSchema("Exterior colour");
  assert.equal(c.safeParse("Soul Red Crystal").success, true);
  assert.equal(c.safeParse("Nardo Grey").success, true);
  assert.equal(c.safeParse("Pearl White").success, true);
  assert.equal(c.safeParse("asdfghjk").success, false);
  assert.equal(c.safeParse("x".repeat(41)).success, false);
});

// ── 4. duplicate photos ────────────────────────────────────────────────────

test("the same photo repeated does not satisfy the photo minimum", () => {
  const one = "https://res.cloudinary.com/demo/image/upload/v1/cars/abc123.jpg";
  assert.equal(distinctPhotoCount(Array(MIN_PUBLISH_PHOTOS).fill(one)), 1);
});

test("cache-busting and transformation variants are the same photo", () => {
  const urls = [
    "https://res.cloudinary.com/demo/image/upload/v1/cars/abc123.jpg",
    "https://res.cloudinary.com/demo/image/upload/v1/cars/abc123.jpg?v=2",
    "https://res.cloudinary.com/demo/image/upload/w_800/v1/cars/abc123.jpg",
    "https://res.cloudinary.com/demo/image/upload/w_200,h_200/v9/cars/abc123.webp",
    "https://res.cloudinary.com/demo/image/upload/v1/cars/ABC123.JPG",
  ];
  assert.equal(distinctPhotoCount(urls), 1, "all five are one photograph");
});

test("genuinely different photos still count", () => {
  const urls = Array.from({ length: MIN_PUBLISH_PHOTOS }, (_, i) =>
    `https://res.cloudinary.com/demo/image/upload/v1/cars/photo-${i}.jpg`);
  assert.equal(distinctPhotoCount(urls), MIN_PUBLISH_PHOTOS);
});

test("photo identity ignores blanks and survives malformed URLs", () => {
  assert.equal(photoIdentity(""), "");
  assert.equal(distinctPhotoCount(["", "   ", ""]), 0);
  assert.equal(distinctPhotoCount(["/local/a.jpg", "/other/a.jpg"]), 1, "same basename, same asset");
  assert.equal(distinctPhotoCount(undefined), 0);
});

// ── 5. the direct-API path ─────────────────────────────────────────────────

const VALID_BODY = {
  year: 2015,
  make: "Toyota",
  model: "Harrier",
  price: 2_500_000,
  mileage: 120_000,
  fuel: "petrol",
  transmission: "auto",
  bodyType: "suv",
  condition: "locally_used",
  location: "Nairobi",
  description: "Well maintained family SUV with full service history and new tyres fitted last year.",
};

test("a well-formed listing still passes — the guard must not block real work", () => {
  const r = vehicleFieldsSchema.safeParse(VALID_BODY);
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
});

test("the dealer field schema refuses every reported value", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["mileage",        { mileage: "1e+18" }],
    ["negative mileage", { mileage: -5 }],
    ["model",          { model: REPORTED.model }],
    ["trim",           { trim: REPORTED.trim }],
    ["engineCc",       { specifications: { engineCc: REPORTED.engineCc } }],
    ["horsepower",     { specifications: { horsepower: REPORTED.horsepower } }],
    ["torqueNm",       { specifications: { torqueNm: REPORTED.torqueNm } }],
    ["previousOwners", { previousOwners: REPORTED.previousOwners }],
    ["price overflow", { price: Number.MAX_VALUE }],
    ["NaN mileage",    { mileage: NaN }],
    ["Infinity price", { price: Infinity }],
  ];
  for (const [label, patch] of cases) {
    const r = vehicleFieldsSchema.safeParse({ ...VALID_BODY, ...patch });
    assert.equal(r.success, false, `${label} must be refused on the direct API path`);
  }
});

test("missing required information is refused", () => {
  for (const field of ["year", "make", "model", "price", "mileage", "location"]) {
    const body = { ...VALID_BODY };
    delete (body as Record<string, unknown>)[field];
    assert.equal(
      vehicleFieldsSchema.safeParse(body).success, false,
      `a listing without ${field} must not validate`,
    );
  }
});

test("the dealer route now validates fields at all", () => {
  // It used to be `createDealerCar(dealer.id, { ...body, status })` with no
  // field schema whatsoever, so none of the above applied to it.
  const src = readFileSync("app/api/dealer/listings/route.ts", "utf8");
  assert.match(src, /vehicleFieldsSchema\.safeParse\(body\)/, "the body must be validated");
  assert.ok(
    src.indexOf("vehicleFieldsSchema.safeParse") < src.indexOf("createDealerCar("),
    "validation must run before the insert",
  );
  assert.ok(
    !/createDealerCar\(dealer\.id, \{ \.\.\.body, status \}\)/.test(src),
    "the raw-body spread is back",
  );
});

// ── 6. the preview ─────────────────────────────────────────────────────────

test("absurd numbers are never formatted into impressive-looking values", () => {
  // The preview turned "1e+18" into "1,000,000,000,000,000,000 km". Digit
  // grouping is what made nonsense look like a specification.
  assert.equal(formatIfValid("1e+18", "mileageKm", " km"), null);
  assert.equal(formatIfValid(Infinity, "mileageKm", " km"), null);
  assert.equal(formatIfValid(NaN, "priceKsh"), null);
  assert.equal(formatIfValid(-1, "mileageKm", " km"), null);
  assert.equal(formatIfValid(REPORTED.engineCc, "engineCc", " cc"), null);
});

test("valid numbers still format normally", () => {
  assert.equal(formatIfValid(120_000, "mileageKm", " km"), "120,000 km");
  assert.equal(formatIfValid("2500000", "priceKsh"), "2,500,000");
  assert.equal(isDisplayableNumber(1800, "engineCc"), true);
});

test("missing values are reported as missing, not as zero", () => {
  assert.equal(formatIfValid(undefined, "mileageKm", " km"), null);
  assert.equal(formatIfValid("", "priceKsh"), null);
  assert.equal(isDisplayableNumber(null), false);
});

test("the preview formats through the validated helper, not Number() directly", () => {
  // Comments are stripped first: the code explains the defect it fixed, and
  // that explanation quotes the very pattern being banned.
  const src = readFileSync("app/sell/new/page.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const start = src.indexOf("function LivePreview");
  const body = src.slice(start, start + 2600);
  assert.ok(
    !/Number\(values\.(mileage|price)\)\.toLocaleString\(\)/.test(body),
    "the unguarded Number().toLocaleString() formatting is back",
  );
  assert.match(body, /formatIfValid\(values\.mileage, "mileageKm"/);
  assert.match(body, /formatIfValid\(values\.price, "priceKsh"\)/);
});

// ── 7. limits are shared, not duplicated ───────────────────────────────────

test("the client form no longer defines its own numeric bounds", () => {
  const src = readFileSync("app/sell/new/page.tsx", "utf8");
  assert.ok(
    !/function optionalNum\(/.test(src),
    "the form's private bounds helper is back — it will drift from the server",
  );
  assert.match(src, /from "@\/lib\/vehicle-limits"/, "bounds must be imported");
});

// ── 8. make validation (Phase 2 / Task 5) ──────────────────────────────────

test("make rejects mashing but accepts marques absent from the reference table", () => {
  const m = makeSchema();
  assert.equal(m.safeParse("asdfghjk").success, false, "z.string().min(1) used to accept this");
  assert.equal(m.safeParse("").success, false);
  assert.equal(m.safeParse("   ").success, false);

  // The makes table holds only 18 manufacturers. Every name below is a real
  // marque imported into this market and MISSING from that table — proof
  // that the table cannot be used as a reject-list.
  const absentButReal = [
    "Daihatsu", "Volvo", "Jeep", "Mahindra", "Chery", "Haval", "BYD",
    "SsangYong", "Chevrolet", "Porsche", "Renault", "Fiat", "MG", "Datsun",
    "Infiniti", "Scion", "Proton", "Tata", "Great Wall", "Opel",
  ];
  for (const name of absentButReal) {
    assert.equal(m.safeParse(name).success, true, `"${name}" is a real make and must be accepted`);
  }
});

test("known makes short-circuit, unknown makes simply are not known", () => {
  const known = ["Toyota", "Mercedes-Benz", "Land Rover"];
  assert.equal(isKnownMake("toyota", known), true, "comparison ignores case");
  assert.equal(isKnownMake("  Land Rover ", known), true, "and surrounding space");
  assert.equal(isKnownMake("Daihatsu", known), false);
  // Being unknown must not be the same as being invalid.
  assert.equal(makeSchema().safeParse("Daihatsu").success, true);
});

// ── 9. messages a seller can act on (found in browser testing) ─────────────

test("an unconvertibly large number gets the field's guidance, not Zod internals", () => {
  // "1e+18" exceeds MAX_SAFE_INTEGER, so it never converts and used to fall
  // through to "Expected number, received string" — true, and useless. The
  // browser pass showed that message to the seller verbatim.
  const r = boundedNumber("mileageKm", { unit: "km" }).safeParse("1e+18");
  assert.equal(r.success, false);
  const msg = r.success ? "" : r.error.issues[0].message;
  assert.match(msg, /between 0 and 1,500,000 km/, `got: ${msg}`);
  assert.ok(!/Expected number/.test(msg), "Zod's internal wording is back");
});

test("every bounded field explains its own range when given nonsense", () => {
  for (const [key, unit] of [["engineCc","cc"],["horsepower","hp"],["torqueNm","Nm"],["previousOwners",""]]) {
    const r = optionalBoundedNumber(key, { unit });
    for (const bad of ["876567897788898989", "notanumber", "1e+18"]) {
      const out = r.safeParse(bad);
      assert.equal(out.success, false, `${key} must refuse ${bad}`);
      const m = out.success ? "" : out.error.issues[0].message;
      assert.match(m, /Enter a value between/, `${key}/${bad} gave: ${m}`);
    }
  }
});

test("the form renders an error slot for every validated field", () => {
  // These were registered and validated but had no error prop, so an invalid
  // value blocked Continue while displaying nothing at all.
  const src = readFileSync("app/sell/new/page.tsx", "utf8");
  for (const name of [
    "trim", "previousOwners",
    "specifications.engineCc", "specifications.horsepower", "specifications.torqueNm",
    "specifications.seats", "specifications.fuelEconomyKmL",
  ]) {
    assert.ok(
      src.includes(`fieldError("${name}")`),
      `${name} has no error slot — it would fail silently`,
    );
  }
  assert.ok(!/<Field label="Trim \/ variant \(optional\)">/.test(src),
    "the Trim field lost its error prop again");
});

// ── 10. the dealer path accepts only named, typed keys ────────────────────

const DEALER_PAYLOAD = {
  year: 2016, make: "Mazda", model: "CX-5", trim: "2.2 Diesel AWD",
  price: 3_200_000, mileage: 98_000,
  fuel: "diesel", transmission: "auto", bodyType: "suv",
  condition: "foreign_used", location: "Mombasa",
  description: "Imported 2016 CX-5 with full service history, recent major service done and clean logbook.",
  images: Array.from({ length: 10 }, (_, i) => `https://res.cloudinary.com/x/image/upload/v1/c/p${i}.jpg`),
  features: ["Sunroof", "Leather seats"],
  financingAvailable: true, hirePurchaseAvailable: false,
  vin: "JM3KE4DY0G0123456",
  vinVerified: true, serviceHistoryAvailable: true, ownershipVerified: false,
  inspectionAvailable: true, mileageVerified: true, logbookVerified: true,
  registrationNumber: "KDA123A", accidentHistory: "none",
  specifications: { engineCc: 2200, horsepower: 175, seats: 5 },
};

test("a realistic dealer submission still validates end to end", () => {
  // The containment must not break the form it protects.
  const r = vehicleFieldsSchema.safeParse(DEALER_PAYLOAD);
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues, null, 2));
  if (r.success) {
    assert.equal(r.data.vinVerified, true, "seller-declared flags must survive");
    assert.equal(r.data.images.length, 10);
    assert.equal(r.data.registrationNumber, "KDA123A");
  }
});

test("unknown keys are dropped instead of reaching the insert", () => {
  // The route used to spread the raw body, so an invented key travelled
  // straight into createDealerCar.
  const r = vehicleFieldsSchema.safeParse({
    ...DEALER_PAYLOAD, sellerUserId: "someone-else", dealerId: "another-dealer",
    createdAt: "1999-01-01", views: 99999, somethingInvented: true,
  });
  assert.equal(r.success, true);
  if (r.success) {
    for (const key of ["sellerUserId", "dealerId", "createdAt", "views", "somethingInvented"]) {
      assert.ok(!(key in r.data), `${key} survived validation and would reach the database`);
    }
  }
});

test("trust flags must be booleans, not whatever the caller sends", () => {
  for (const bad of ["yes", 1, {}, "true"]) {
    const r = vehicleFieldsSchema.safeParse({ ...DEALER_PAYLOAD, vinVerified: bad });
    assert.equal(r.success, false, `vinVerified: ${JSON.stringify(bad)} must be refused`);
  }
});

test("the dealer route no longer spreads the request body", () => {
  const src = readFileSync("app/api/dealer/listings/route.ts", "utf8");
  assert.ok(
    !/createDealerCar\([^)]*\.\.\.body/.test(src),
    "the raw-body spread is back — unvalidated keys would reach the insert",
  );
  assert.match(src, /createDealerCar\(dealer\.id, \{ \.\.\.fields\.data/);
});
