import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessDescription, descriptionSchema } from "../lib/description-quality.ts";

// Regression tests for a live defect: a 2024 Mercedes-Benz C200 was published
// with the description
//
//   "uhygby7gbygb y hgbyt67tg gy76ygt6tyg"
//
// The only validation anywhere was z.string().min(30), and that string is 36
// characters, so it passed on both the client and the server.

const THE_BUG = "uhygby7gbygb y hgbyt67tg gy76ygt6tyg";

const MUST_NOT_PUBLISH: [string, string][] = [
  ["the reported description", THE_BUG],
  ["keyboard rows", "asdfghjkl asdfghjkl qwertyuiop zxcvbnm"],
  ["reverse keyboard rows", "jhgfdsa kjhgfds lkjhgfd mnbvcxz poiuytr"],
  ["one character repeated", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  ["one word repeated", "car car car car car car car car car car"],
  ["two words padded out", "good car good car good car good car good car"],
  ["digits and symbols", "123456 !!! 7890 @@@ 456789 ### 12345 $$$"],
  ["a short unit repeated", "gbygbygbygb gbygbygbygb gbygbygbygb"],
  ["consonant soup", "bcdfghjk lmnpqrst vwxyzbcd fghjklmn pqrstvwx"],
];

const MUST_PUBLISH: [string, string][] = [
  ["short but informative", "Clean 2015 Toyota Axio, 1500cc, one owner, full service history."],
  ["terse", "Well maintained, accident free, new tyres, logbook ready."],
  ["ordinary", "Selling my 2018 Mazda CX-5. Locally used, 78,000 km, full service history at the dealer. Accident free with a clean logbook. New tyres fitted last month."],
  ["low on detail but genuine", "Good condition car, well maintained, serious buyers only please."],
  ["contains a model code", "Toyota Premio ZZT240, 1800cc petrol, imported 2019, 95000 km, very clean."],
  ["Swahili mixed in", "Gari safi sana, imetunzwa vizuri, service history kamili, tyres mpya."],
  ["no automotive vocabulary at all", "My late uncle left this to me and I simply have nowhere to keep it, so it must go this month."],
];

test("the exact description from the live listing is rejected", () => {
  const a = assessDescription(THE_BUG);
  assert.equal(a.verdict, "reject");
  assert.equal(a.acceptable, false, "it must not be publishable");
  assert.ok(a.reasons.length > 0, "the seller must be told why");
  assert.ok(a.recommendation, "and what to do instead");
});

test("a 36-character string proves length alone cannot be the test", () => {
  // The point of the whole module: the old rule was satisfied by this input.
  assert.ok(THE_BUG.length >= 30, "premise check - the old min(30) passed this");
  assert.equal(assessDescription(THE_BUG).verdict, "reject");
});

test("meaningless descriptions are never publishable", () => {
  for (const [label, text] of MUST_NOT_PUBLISH) {
    const a = assessDescription(text);
    assert.notEqual(a.verdict, "good", `${label} must not be marked good: scored ${a.score}`);
    assert.equal(a.acceptable, false, `${label} must not be publishable: scored ${a.score}`);
  }
});

test("legitimate descriptions are accepted without review", () => {
  // False positives matter more than false negatives here: a refused seller
  // is a lost listing, while a weak description costs a moderator a moment.
  for (const [label, text] of MUST_PUBLISH) {
    const a = assessDescription(text);
    assert.equal(a.verdict, "good", `${label} was not accepted: scored ${a.score} (${a.reasons.join("; ")})`);
    assert.equal(a.acceptable, true, label);
    assert.deepEqual(a.reasons, [], `${label} should have no complaints`);
  }
});

test("a short description is fine when it carries real information", () => {
  const a = assessDescription("Clean 2015 Axio, 1500cc, one owner, full service history.");
  assert.equal(a.verdict, "good");
  assert.ok(a.metrics.length < 70, "this is deliberately a short description");
  assert.ok(a.metrics.automotiveTerms >= 2, "its value is information density, not length");
});

test("an empty or whitespace description is refused with a specific message", () => {
  for (const input of ["", "   ", null, undefined]) {
    const a = assessDescription(input);
    assert.equal(a.verdict, "reject");
    assert.equal(a.acceptable, false);
  }
  assert.match(assessDescription("").reasons[0], /required/i);
});

test("a too-short description says how short it is", () => {
  const a = assessDescription("nice car");
  assert.equal(a.verdict, "reject");
  assert.match(a.reasons[0], /8 characters/);
});

test("the vowel ratio is the signal that separates prose from mashing", () => {
  // Documents why this works, so the threshold is not later "tidied" away.
  const mash = assessDescription(THE_BUG);
  const prose = assessDescription(MUST_PUBLISH[2][1]);
  assert.ok(mash.metrics.vowelRatio < 0.1, `expected near-zero, got ${mash.metrics.vowelRatio}`);
  assert.ok(prose.metrics.vowelRatio > 0.25, `expected prose-like, got ${prose.metrics.vowelRatio}`);
});

test("identifier-shaped tokens are not counted against the seller", () => {
  // "ZZT240" and "1500cc" are not misspellings.
  const a = assessDescription("Toyota Premio ZZT240 1800cc petrol imported 2019 95000 km very clean");
  assert.equal(a.verdict, "good");
});

test("the schema refuses a confident rejection and allows the uncertain band", () => {
  const schema = descriptionSchema();

  const refused = schema.safeParse(THE_BUG);
  assert.equal(refused.success, false, "the server schema must refuse it");
  assert.match(refused.error.issues[0].message, /\S/, "the message must be non-empty");

  for (const [label, text] of MUST_PUBLISH) {
    assert.equal(schema.safeParse(text).success, true, `${label} must pass the schema`);
  }
});

// ---- wiring: the server must be the authority ----

test("the server route validates the description through the shared module", () => {
  const src = readFileSync("app/api/cars/route.ts", "utf8");
  assert.match(src, /descriptionSchema\(\)/, "the route must use the shared schema");
  assert.ok(
    !/description:\s*z\.string\(\)\.min\(30\)/.test(src),
    "the bare length check is back on the server",
  );
});

test("the client form uses the same validator, so the two cannot disagree", () => {
  const src = readFileSync("app/sell/new/page.tsx", "utf8");
  assert.match(src, /descriptionSchema\(\)/);
  assert.ok(
    !/description:\s*z\.string\(\)\.min\(30/.test(src),
    "the form still has its own weaker rule",
  );
});

test("client validation cannot be the only gate - the server schema stands alone", () => {
  // Skipping the browser entirely still hits descriptionSchema() in the route,
  // which is a pure function of the request body.
  const schema = descriptionSchema();
  assert.equal(schema.safeParse(THE_BUG).success, false);
});

test("an uncertain description is held for review rather than published", () => {
  const src = readFileSync("app/api/cars/route.ts", "utf8");
  assert.match(
    src,
    /status:\s*description\.verdict === "review" \? "pending_review" : "active"/,
    "the route must hold an uncertain description for a moderator",
  );
});

test("createPublicCar no longer always takes the 'active' column default", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  assert.match(src, /data\.status \?\? "active"/, "status must be explicit on insert");
});

test("pending_review is a real status and is reachable in the admin filter", () => {
  const types = readFileSync("types/index.ts", "utf8");
  assert.match(types, /"pending_review"/, "CarStatus must include it");

  const admin = readFileSync("app/admin/cars/page.tsx", "utf8");
  assert.match(admin, /pending_review/, "an admin must be able to filter to the review queue");
  assert.ok(
    !/"active", "draft", "pending",/.test(admin),
    'the phantom "pending" filter is back - no row can ever have that status, so it always returned zero listings',
  );
});

test("public visibility still requires status 'active', so held listings stay hidden", () => {
  // pending_review needs no extra exclusion: the public helper allows only
  // 'active', so anything held is out of public view by construction.
  const src = readFileSync("lib/db.ts", "utf8");
  assert.match(src, /\$\{alias\}\.status = 'active'/, "the public visibility rule changed");
});
