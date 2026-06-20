// Visibility tests — covers the five scenarios from the spec.
//
// These are fast unit tests against the pure policy module (no DB). They
// exercise the static-path predicate isVisibleUnderPolicy directly, and
// validate the structure of buildPublicListingVisibilityWhere by reading
// lib/db.ts as a string (importing it natively would pull in @/... path
// aliases Node ESM can't resolve without a loader).
//
// End-to-end DB behaviour (insert, search, detail, wishlist bypass) is
// exercised by scripts/verify-acceptance.mjs.
//
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isVisibleUnderPolicy,
  QUALITY_POLICY_CUTOFF,
  MIN_PUBLISH_PHOTOS,
  MIN_VIN_LEN,
} from "../lib/quality-policy.ts";

// ── Predicate: Scenarios A, B, C from the spec ─────────────────────────────

test("Scenario A — legacy listing (pre-cutoff, 3 photos, no VIN) is visible", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2025-01-15", // before 2026-06-19
    photoCount: 3,
    vin:        null,
  });
  assert.equal(result, true, "Legacy listings must be grandfathered");
});

test("Scenario B — new listing (post-cutoff, 5 photos, no VIN) is hidden", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2026-08-01",
    photoCount: 5,
    vin:        null,
  });
  assert.equal(result, false, "Post-cutoff listings without enough photos must be hidden");
});

test("Scenario C — new listing (post-cutoff, 10 photos, valid VIN) is visible", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2026-08-01",
    photoCount: 10,
    vin:        "JTMBFREV40D012345",
  });
  assert.equal(result, true, "Post-cutoff listings meeting the bar must be visible");
});

test("Scenario C edge — exactly the minimum bar passes", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2026-12-01",
    photoCount: MIN_PUBLISH_PHOTOS,
    vin:        "X".repeat(MIN_VIN_LEN),
  });
  assert.equal(result, true);
});

test("Post-cutoff with photos but missing VIN is hidden", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2026-08-01",
    photoCount: 10,
    vin:        "",
  });
  assert.equal(result, false);
});

test("Post-cutoff with photos but VIN too short is hidden", () => {
  const result = isVisibleUnderPolicy({
    createdAt:  "2026-08-01",
    photoCount: 10,
    vin:        "SHORT", // 5 chars < 11
  });
  assert.equal(result, false);
});

test("Pre-cutoff status is irrelevant to grandfathering (predicate)", () => {
  // The predicate doesn't know about status — that's the SQL helper's job.
  // Confirm grandfathering only depends on createdAt.
  const result = isVisibleUnderPolicy({
    createdAt:  "2020-01-01",
    photoCount: 0,
    vin:        null,
  });
  assert.equal(result, true);
});

// ── SQL helper — read lib/db.ts and assert the visibility clause structure ─

const dbSource = readFileSync(new URL("../lib/db.ts", import.meta.url), "utf8");

test("buildPublicListingVisibilityWhere exists and is exported", () => {
  assert.match(dbSource, /export\s+function\s+buildPublicListingVisibilityWhere/);
});

test("Helper emits status='active' check using the alias", () => {
  assert.match(dbSource, /\$\{alias\}\.status\s*=\s*'active'/);
});

test("Helper emits the grandfather branch with the JS constant value", () => {
  // The cutoff is interpolated from QUALITY_POLICY_CUTOFF (a server constant,
  // safe to inline since it never comes from user input).
  assert.match(dbSource, /\$\{alias\}\.created_at\s*<\s*DATE\s+'\$\{QUALITY_POLICY_CUTOFF\}'/);
});

test("Helper emits the photo-count + VIN-length check", () => {
  assert.match(dbSource, /COALESCE\(array_length\(\$\{alias\}\.images,\s*1\),\s*0\)\s*>=\s*\$\{MIN_PUBLISH_PHOTOS\}/);
  assert.match(dbSource, /\$\{alias\}\.vin\s+IS\s+NOT\s+NULL/);
  assert.match(dbSource, /LENGTH\(\$\{alias\}\.vin\)\s*>=\s*\$\{MIN_VIN_LEN\}/);
});

test("Cutoff constant matches the documented value (2026-06-19)", () => {
  assert.equal(QUALITY_POLICY_CUTOFF, "2026-06-19");
});

// ── Visibility matrix — sliced source scans (per-function) ─────────────────
// Note: the existing functions have complex type annotations whose closing
// braces would defeat a balanced-brace regex, so we slice a window forward
// from each declaration and search within. Each window is sized to comfortably
// cover the function body without overlapping the next export.

function sliceForFn(name: string, windowSize = 4000): string {
  const idx = dbSource.indexOf("function " + name);
  if (idx === -1) throw new Error(`${name} not found in lib/db.ts`);
  return dbSource.slice(idx, idx + windowSize);
}

test("Scenario E — getCarsByIds does NOT apply the visibility helper (wishlist bypass)", () => {
  const slice = sliceForFn("getCarsByIds", 3500);
  assert.doesNotMatch(slice, /buildPublicListingVisibilityWhere/);
  assert.doesNotMatch(slice, /status\s*=\s*'active'/);
});

test("getPublicCars applies the visibility helper (/cars search)", () => {
  const slice = sliceForFn("getPublicCars", 3000);
  assert.match(slice, /buildPublicListingVisibilityWhere/);
});

test("getCarBySlug applies the visibility helper (/cars/[slug] detail)", () => {
  const slice = sliceForFn("getCarBySlug", 3500);
  assert.match(slice, /buildPublicListingVisibilityWhere/);
});

test("buildSearchWhere applies the visibility helper (/api/cars/search)", () => {
  const slice = sliceForFn("buildSearchWhere", 2000);
  assert.match(slice, /buildPublicListingVisibilityWhere/);
});

test("Scenario D — updateDealerCar enforces quality on resulting-active updates", () => {
  // updateDealerCar runs enforcePublishQuality before generating the UPDATE
  // when the resulting status would be 'active'. We assert the guard is
  // present in the source — the runtime path is exercised in the acceptance
  // script.
  const slice = sliceForFn("updateDealerCar", 4000);
  assert.match(slice, /enforcePublishQuality/);
});
