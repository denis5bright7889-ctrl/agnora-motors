import test from "node:test";
import assert from "node:assert/strict";
import { decidePhoto, type ClassificationResult } from "../lib/vehicle-classifier.ts";

// The decision policy matters more than the model: these tests pin down that
// an uncertain result routes to a human instead of being resolved as a
// confident yes or no.

const result = (over: Partial<ClassificationResult>): ClassificationResult => ({
  label: "unchecked", score: null, provider: "test", ...over,
});

test("a confidently detected vehicle is accepted", () => {
  const d = decidePhoto(result({ label: "vehicle", score: 0.93 }));
  assert.equal(d.action, "accept");
});

test("a confidently detected non-vehicle is rejected with a usable message", () => {
  const d = decidePhoto(result({ label: "not_vehicle", score: 0.97 }));
  assert.equal(d.action, "reject");
  assert.ok("message" in d && /vehicle/i.test(d.message));
});

test("low confidence never resolves to a verdict - it goes to review", () => {
  // The rule from the brief: if confidence is low, route for manual
  // moderation rather than pretending the model is certain.
  for (const r of [
    result({ label: "vehicle", score: 0.40 }),
    result({ label: "vehicle", score: 0.70 }),
    result({ label: "not_vehicle", score: 0.50 }),
    result({ label: "not_vehicle", score: 0.80 }),
    result({ label: "uncertain", score: 0.55 }),
    result({ label: "uncertain", score: null }),
  ]) {
    assert.equal(
      decidePhoto(r).action,
      "review",
      `${r.label} @ ${r.score} should be reviewed, not decided`,
    );
  }
});

test("a vehicle label with no score is reviewed, not accepted", () => {
  // A provider that returns a label but no confidence has told us nothing
  // about how sure it is.
  assert.equal(decidePhoto(result({ label: "vehicle", score: null })).action, "review");
});

test("with no classifier configured, uploads are unaffected", () => {
  // 'unchecked' is distinct from 'uncertain': no classifier ran at all.
  // Blocking here would break every upload the moment an env var is missing.
  assert.equal(decidePhoto(result({ label: "unchecked", score: null })).action, "accept");
});

test("rejection requires a higher bar than acceptance", () => {
  // Asymmetry is deliberate: wrongly rejecting a genuine photo costs a
  // listing, so the reject threshold sits above the accept threshold.
  const borderline = result({ label: "not_vehicle", score: 0.80 });
  assert.equal(decidePhoto(borderline).action, "review");
  assert.equal(decidePhoto(result({ label: "not_vehicle", score: 0.90 })).action, "reject");
});
