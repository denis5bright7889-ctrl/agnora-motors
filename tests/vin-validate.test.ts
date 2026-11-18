import test from "node:test";
import assert from "node:assert/strict";
import { validateIdentifier, computeVinCheckDigit } from "../lib/vin-validate.ts";

// These five VINs are real-world/canonical samples whose check digits are
// self-consistent, so they double as a correctness check on the ISO 3779
// transliteration table and weight vector. If the algorithm regresses, these
// fail before any policy test does.
const VALID_VINS = [
  "1HGBH41JXMN109186", // canonical NHTSA sample (check digit X)
  "11111111111111111", // all-ones, famously self-consistent (check digit 1)
  "1M8GDM9AXKP042788", // common reference sample (check digit X)
  "5YJ3E1EA6PF384836", // Tesla Model 3
  "JH4TB2H26CC000000", // Acura (Japan-built, export VIN)
];

test("computeVinCheckDigit matches position 9 for known-good VINs", () => {
  for (const vin of VALID_VINS) {
    assert.equal(
      computeVinCheckDigit(vin),
      vin[8],
      `check digit mismatch for ${vin}`,
    );
  }
});

// --- A. Standard VIN -------------------------------------------------------

test("a valid 17-character VIN is accepted without review", () => {
  const r = validateIdentifier("1HGBH41JXMN109186");
  assert.equal(r.kind, "vin");
  assert.equal(r.status, "valid");
  assert.equal(r.checkDigit, "pass");
  assert.equal(r.acceptable, true);
  assert.equal(r.needsReview, false);
  assert.equal(r.message, null);
});

test("prohibited letters I, O and Q are rejected with a specific message", () => {
  for (const [vin, letter] of [
    ["1HGBH41JXMN10918I", "I"],
    ["1HGBH4OJXMN109186", "O"],
    ["1HGBH4QJXMN109186", "Q"],
  ] as const) {
    const r = validateIdentifier(vin);
    assert.equal(r.status, "invalid", `${vin} should be invalid`);
    assert.equal(r.acceptable, false);
    // The message must name the offending letter - this is the whole point of
    // not saying "Invalid VIN".
    assert.match(r.message ?? "", /I, O or Q/);
    assert.match(r.message ?? "", new RegExp(`found ${letter}`));
  }
});

test("a North American VIN with a wrong check digit is invalid and says why", () => {
  // Same VIN as the canonical sample with position 9 changed X -> 5.
  const r = validateIdentifier("1HGBH41J5MN109186");
  assert.equal(r.kind, "vin");
  assert.equal(r.status, "invalid");
  assert.equal(r.checkDigit, "fail");
  assert.equal(r.acceptable, false);
  assert.match(r.message ?? "", /check digit/i);
  // It must report both what was entered and what was expected.
  assert.match(r.message ?? "", /position 9 is "5"/);
  assert.match(r.message ?? "", /expected "X"/);
});

test("a non-North-American VIN with a wrong check digit is suspect, not refused", () => {
  // W = Germany. Outside North America position 9 is frequently a filler
  // character, so refusing these would reject genuine imports.
  const r = validateIdentifier("WBA3A5C55DF351104");
  assert.equal(r.kind, "vin");
  assert.equal(r.status, "suspect");
  assert.equal(r.checkDigit, "fail");
  assert.equal(r.acceptable, true, "an import must still be listable");
  assert.equal(r.needsReview, true, "but a human should confirm it");
});

test("an invalid-length identifier is distinguished from an invalid one", () => {
  const short = validateIdentifier("ABC12");
  assert.equal(short.status, "invalid");
  assert.match(short.message ?? "", /too short/i);

  const long = validateIdentifier("12345678901234567890123");
  assert.equal(long.status, "invalid");
  assert.match(long.message ?? "", /23 characters/);
});

test("an empty identifier asks for input rather than reporting a format error", () => {
  for (const input of ["", "   ", null, undefined, "---"]) {
    const r = validateIdentifier(input);
    assert.equal(r.acceptable, false);
    assert.match(r.message ?? "", /Enter the vehicle's VIN or chassis number/);
  }
});

// --- B. Japanese chassis / frame numbers -----------------------------------

test("Japanese chassis numbers are valid and are not forced into VIN format", () => {
  for (const [input, make] of [
    ["ZVW30-1234567", "Toyota"],
    ["NZE141-9012345", "Toyota"],
    ["GD1-1234567", "Honda"],
    ["Z33-123456", "Nissan"],
  ] as const) {
    const r = validateIdentifier(input);
    assert.equal(r.kind, "jp_chassis", `${input} should be a chassis number`);
    assert.equal(r.status, "valid");
    assert.equal(r.acceptable, true);
    // A chassis number has no check digit; claiming one passed or failed
    // would be fabricating a result.
    assert.equal(r.checkDigit, "not_applicable");
    assert.equal(r.manufacturer, make);
    assert.equal(r.needsReview, false, "a known model code needs no review");
  }
});

test("a chassis number with an unrecognised model code is flagged, not rejected", () => {
  // Deliberately NOT reported as valid. The shape "letters then 5-7 digits"
  // is weak evidence on its own — it also describes engine codes and part
  // numbers — so an unattributable match goes to a human rather than being
  // asserted as a valid chassis number.
  const r = validateIdentifier("QQQQ9-123456");
  assert.equal(r.kind, "jp_chassis", "the shape is still recognised as chassis-like");
  assert.equal(r.status, "unrecognised");
  assert.equal(r.acceptable, true, "a seller is never refused for an unfamiliar format");
  assert.equal(r.needsReview, true);
  assert.equal(r.manufacturer, undefined, "no manufacturer may be invented");
});

test("an engine code is not accepted as a chassis number", () => {
  // Regression for a real listing: a Subaru Legacy was published with
  // "EJ20-D351259" as its VIN. EJ20 is the Subaru boxer engine family, and
  // the string is 11 characters of letters-then-digits, so it passed both the
  // publish length rule and the chassis shape and was called valid.
  const r = validateIdentifier("EJ20-D351259");
  assert.equal(r.normalized, "EJ20D351259");
  assert.notEqual(r.status, "valid", "an engine code must never be valid");
  assert.equal(r.status, "suspect");
  assert.equal(r.kind, "unknown", "it is not a chassis number, so do not claim it is");
  assert.equal(r.needsReview, true);
  assert.equal(r.manufacturer, undefined);
  assert.match(r.message ?? "", /engine code/i, "the seller must be told what is wrong");
  assert.match(r.message ?? "", /chassis number is on the plate/i, "and where to find the right one");
});

test("engine families across manufacturers are all caught", () => {
  for (const input of [
    "EJ25-123456",   // Subaru
    "SR20-987654",   // Nissan
    "RB26-112233",   // Nissan
    "K20A-445566",   // Honda
    "4G63-778899",   // Mitsubishi
    "VQ35-204060",   // Nissan
    "FA20-135790",   // Subaru
    "M13A-246800",   // Suzuki
  ]) {
    const r = validateIdentifier(input);
    assert.equal(r.status, "suspect", `${input} should be flagged as an engine code`);
    assert.notEqual(r.kind, "jp_chassis", `${input} must not be called a chassis number`);
  }
});

test("a genuine chassis code is not caught by the engine-code check", () => {
  // The guard must not become so broad that it refuses real chassis numbers.
  for (const [input, make] of [
    ["ZVW30-1234567", "Toyota"],
    ["ZZT240-0012345", "Toyota"],
    ["GD1-1234567", "Honda"],
    ["Z33-123456", "Nissan"],
    ["GDB-123456", "Subaru"],
  ] as const) {
    const r = validateIdentifier(input);
    assert.equal(r.status, "valid", `${input} should remain valid`);
    assert.equal(r.kind, "jp_chassis");
    assert.equal(r.manufacturer, make);
    assert.equal(r.needsReview, false, "a recognised code needs no manual check");
  }
});

test("a bare engine code with no serial falls through to the length rule", () => {
  // "EJ20" alone is four characters — too short to be any identifier, and the
  // length message is the more useful one.
  const r = validateIdentifier("EJ20");
  assert.equal(r.status, "invalid");
  assert.equal(r.acceptable, false);
  assert.match(r.message ?? "", /too short/i);
});

test("an identifier in no recognised format is unrecognised, not invalid", () => {
  // Plausible length, but matches neither a VIN nor a chassis shape. The
  // seller may have entered it correctly in a format we do not model, so it
  // is accepted and queued for a human.
  const r = validateIdentifier("ZZZZZZZZZZZZ");
  assert.equal(r.kind, "unknown");
  assert.equal(r.status, "unrecognised");
  assert.equal(r.acceptable, true);
  assert.equal(r.needsReview, true);
  assert.match(r.message ?? "", /moderator will verify/i);
});

test("a 17-character string is judged as a VIN, never as a chassis number", () => {
  // Guards against the chassis branch swallowing malformed VINs and silently
  // marking them valid.
  const r = validateIdentifier("ABCDEFGH123456789");
  assert.equal(r.kind, "vin");
});

// --- C. Normalization (shared with duplicate detection) --------------------

test("case and separators do not change the identifier", () => {
  const variants = [
    "1HGBH41JXMN109186",
    "1hgbh41jxmn109186",
    " 1HGBH41JXMN109186 ",
    "1HG-BH41J-XMN109186",
    "1HG BH41J XMN109186",
    "1hg-bh41j xmn109186\t",
  ];
  const results = variants.map(validateIdentifier);
  for (const r of results) {
    assert.equal(r.normalized, "1HGBH41JXMN109186");
    assert.equal(r.status, "valid", "every spelling is the same valid VIN");
  }
  // All normalise to one string, which is what makes duplicate detection work
  // regardless of how the VIN was typed.
  assert.equal(new Set(results.map((r) => r.normalized)).size, 1);
});

test("chassis numbers normalise identically with and without the hyphen", () => {
  const a = validateIdentifier("ZVW30-1234567");
  const b = validateIdentifier("zvw301234567");
  assert.equal(a.normalized, b.normalized);
  assert.equal(a.manufacturer, b.manufacturer);
});

test("acceptable is never true for a structurally broken identifier", () => {
  // Invariant: the write path keys off `acceptable`, so this must hold for
  // every rejection reason.
  for (const bad of ["", "ABC12", "1HGBH41JXMN10918I", "1HGBH41J5MN109186", "x".repeat(25)]) {
    assert.equal(validateIdentifier(bad).acceptable, false, `${bad} must not be acceptable`);
  }
});
