import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVin } from "../lib/quality-policy.ts";

const VIN = "JTMBFREV40D012345";

test("a VIN typed on a phone keyboard equals the same VIN pasted on a desktop", () => {
  // This is the bug the normaliser exists for: the listing forms only apply
  // CSS uppercase, so the submitted value keeps whatever case was typed.
  assert.equal(normalizeVin(VIN.toLowerCase()), normalizeVin(VIN));
  assert.equal(normalizeVin("jtmbfrev40d012345"), VIN);
});

test("strips separators people type or paste from a logbook", () => {
  assert.equal(normalizeVin("JTMB-FREV-40D0-12345"), VIN);
  assert.equal(normalizeVin("JTMB FREV 40D 012345"), VIN);
  assert.equal(normalizeVin("  JTMBFREV40D012345  "), VIN);
});

test("matches the decoder and corrections-loop normalisation", () => {
  // lib/vin-decoder and lib/vin-corrections both use uppercase + [^A-Z0-9]
  // removal. If those ever diverge from this, prefix-keyed learning silently
  // stops matching stored VINs.
  const messy = " jtmb-frev 40d012345 ";
  const expected = messy.toUpperCase().replace(/[^A-Z0-9]/g, "");
  assert.equal(normalizeVin(messy), expected);
});

test("returns an empty string for absent input rather than throwing", () => {
  assert.equal(normalizeVin(null), "");
  assert.equal(normalizeVin(undefined), "");
  assert.equal(normalizeVin(""), "");
});

test("a VIN that is only separators normalises away and fails the length bar", () => {
  // 11 raw characters would clear a naive min-length check; 0 real ones must not.
  assert.equal(normalizeVin("-- -- -- --"), "");
});
