import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decidePhoto, classifyVehicleImage, getVehicleClassifier, resetVehicleClassifier,
  type ClassificationResult,
} from "../lib/vehicle-classifier.ts";

// Regression tests for the fail-closed vehicle classifier.
//
// A 1024x768 gaussian-noise JPEG was accepted by the real upload endpoint
// with status 200 and review=false, because with no provider configured every
// image came back "unchecked" and decidePhoto() mapped unchecked → accept.
// The gate was wide open.
//
// These tests use MOCKED classifier responses. They prove the plumbing —
// which outcome each label produces, and that an unverifiable image is
// refused before Cloudinary. They prove NOTHING about how accurately the
// model distinguishes a car from a sofa; that needs real photographs through
// scripts/verify-classifier.mjs, and is reported separately.

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const r = (label: string, score: number | null = null): ClassificationResult =>
  ({ label, score, provider: "test" } as ClassificationResult);

// ── 1-3. the three classified outcomes ────────────────────────────────────

test("1. a confidently classified vehicle is accepted", () => {
  assert.equal(decidePhoto(r("vehicle", 0.95)).action, "accept");
  assert.equal(decidePhoto(r("vehicle", 0.75)).action, "accept", "the threshold is inclusive");
});

test("2. an uncertain image is held for review, not accepted outright", () => {
  // Real ONNX output for gaussian noise is label=uncertain score~0.004.
  const d = decidePhoto(r("uncertain", 0.004));
  assert.equal(d.action, "review");
  assert.notEqual(d.action, "accept", "noise must not pass as a verified vehicle photo");
});

test("3. a confidently non-vehicle image is rejected", () => {
  const d = decidePhoto(r("not_vehicle", 0.9));
  assert.equal(d.action, "reject");
  assert.match(d.message, /doesn't appear to show a vehicle/i);
});

test("a weakly-scored vehicle does not reach accept", () => {
  assert.equal(decidePhoto(r("vehicle", 0.5)).action, "review");
  assert.equal(decidePhoto(r("not_vehicle", 0.2)).action, "review");
});

// ── 4-7. the unavailable paths — the heart of fail-closed ─────────────────

test("7. missing classifier configuration refuses the upload", () => {
  // THE ORIGINAL DEFECT, pinned. unchecked used to map to accept.
  const d = decidePhoto(r("unchecked"));
  assert.equal(d.action, "unavailable", "an unclassified image must not be accepted");
  assert.notEqual(d.action, "accept");
  assert.match(d.message, /temporarily unavailable/i);
  assert.match(d.message, /try again/i, "the seller needs to know what to do");
});

test("4. a classifier that throws fails closed, not open", async () => {
  const prev = process.env.VEHICLE_CLASSIFIER_URL;
  try {
    process.env.VEHICLE_CLASSIFIER_URL = "http://127.0.0.1:9/never-listening";
    resetVehicleClassifier();
    assert.equal(getVehicleClassifier().name, "http", "the http provider should be selected");

    const out = await classifyVehicleImage(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
    assert.equal(out.label, "unavailable", "a connection failure must not read as uncertain");
    assert.equal(decidePhoto(out).action, "unavailable");
  } finally {
    if (prev === undefined) delete process.env.VEHICLE_CLASSIFIER_URL;
    else process.env.VEHICLE_CLASSIFIER_URL = prev;
    resetVehicleClassifier();
  }
});

test("5. a timeout is the absence of an opinion, not a weak one", () => {
  // The distinction that was collapsed: a provider outage used to become
  // "uncertain", which routes to review and lets the upload through.
  assert.equal(decidePhoto(r("unavailable")).action, "unavailable");
  assert.notEqual(decidePhoto(r("unavailable")).action, decidePhoto(r("uncertain", 0.3)).action);

  const src = code("lib/vehicle-classifier.ts");
  const fn = src.slice(src.indexOf("export async function classifyVehicleImage"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /catch[\s\S]*label: "unavailable"/, "a thrown error must map to unavailable");
  assert.ok(
    !/catch[\s\S]*label: "uncertain"/.test(body),
    "a provider failure is being reported as a weak opinion again",
  );
});

test("6. a malformed classifier response is treated as no answer", async () => {
  const src = code("lib/vehicle-classifier.ts");
  assert.match(src, /VALID_LABELS\.has\(result\.label\)/,
    "an unrecognised label must not be trusted");
  const fn = src.slice(src.indexOf("export async function classifyVehicleImage"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /!result \|\| !VALID_LABELS/, "a null/!valid result must fail closed");
});

test("every label maps to a defined action, with no silent default", () => {
  const seen = new Map<string, string>();
  for (const label of ["vehicle", "not_vehicle", "uncertain", "unchecked", "unavailable"]) {
    const d = decidePhoto(r(label, 0.99));
    assert.ok(["accept", "review", "reject", "unavailable"].includes(d.action), label);
    seen.set(label, d.action);
  }
  assert.equal(seen.get("unchecked"), "unavailable");
  assert.equal(seen.get("unavailable"), "unavailable");
  assert.equal(seen.get("vehicle"), "accept");
  assert.equal(seen.get("not_vehicle"), "reject");
});

// ── 9 + 12. the route: refuse before Cloudinary ───────────────────────────

test("9/12. an unverifiable photo is refused BEFORE it reaches Cloudinary", () => {
  // This is what keeps the account free of orphaned assets and stops a
  // misleading classification row being written.
  const src = code("app/api/upload/route.ts");
  const unavailableAt = src.indexOf('decision.action === "unavailable"');
  const rejectAt      = src.indexOf('decision.action === "reject"');
  const uploadAt      = src.indexOf("cloudinary.uploader.upload");
  // Anchor on the CALL, not the import at the top of the file.
  const recordAt      = src.indexOf("await recordUploadClassification(");

  assert.ok(unavailableAt > -1, "the route must handle the unavailable decision");
  assert.ok(unavailableAt < uploadAt, "the 503 must return before the Cloudinary upload");
  assert.ok(rejectAt < uploadAt, "the 422 must return before the Cloudinary upload");
  assert.ok(unavailableAt < recordAt, "no classification row may be written for a refused photo");
});

test("the unavailable response is a 503 with a retry hint", () => {
  const src = code("app/api/upload/route.ts");
  const block = src.slice(src.indexOf('decision.action === "unavailable"'));
  const end = block.indexOf("}\n");
  const body = block.slice(0, end + 200);
  assert.match(body, /status: 503/, "a temporary outage is a 503, not a 400");
  assert.match(body, /Retry-After/, "the client should be told when to retry");
  assert.match(body, /classifier_unavailable/, "a machine-readable code helps the UI");
});

// ── 8, 10, 11. publication enforcement ────────────────────────────────────

test("8/10. unchecked photos cannot satisfy the publication requirement", () => {
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function countDistinctPhotoContent"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(
    body,
    /record\.label === "not_vehicle" \|\| record\.label === "unchecked"/,
    "photos the server recorded as unverified must not count toward the ten",
  );
  assert.match(body, /continue;/, "they must be skipped, not counted");
});

test("11. genuinely classified vehicle photos still count", () => {
  // The guard must not block the workflow it protects.
  const src = readFileSync("lib/db.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function countDistinctPhotoContent"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  // Only the two unverified labels are excluded; vehicle/uncertain fall through.
  const excluded = body.match(/record\.label === "([a-z_]+)"/g) ?? [];
  assert.equal(excluded.length, 2, `unexpected label exclusions: ${excluded.join(", ")}`);
  assert.ok(!/record\.label === "vehicle"/.test(body), "classified vehicles must still count");
});

// ── configuration and provider selection ──────────────────────────────────

test("provider selection is explicit and defaults to no provider", () => {
  const prevMode = process.env.VEHICLE_CLASSIFIER;
  const prevUrl = process.env.VEHICLE_CLASSIFIER_URL;
  try {
    delete process.env.VEHICLE_CLASSIFIER;
    delete process.env.VEHICLE_CLASSIFIER_URL;
    resetVehicleClassifier();
    assert.equal(getVehicleClassifier().name, "none",
      "nothing should switch itself on implicitly");

    process.env.VEHICLE_CLASSIFIER = "onnx";
    resetVehicleClassifier();
    assert.equal(getVehicleClassifier().name, "onnx");
  } finally {
    if (prevMode === undefined) delete process.env.VEHICLE_CLASSIFIER;
    else process.env.VEHICLE_CLASSIFIER = prevMode;
    if (prevUrl === undefined) delete process.env.VEHICLE_CLASSIFIER_URL;
    else process.env.VEHICLE_CLASSIFIER_URL = prevUrl;
    resetVehicleClassifier();
  }
});

test("the ONNX runtime is a declared dependency, not an extraneous install", () => {
  // It was installed but absent from package.json, so `npm ci` would not have
  // produced it and the provider would have failed in any fresh environment.
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const declared =
    pkg.dependencies?.["onnxruntime-web"] ?? pkg.optionalDependencies?.["onnxruntime-web"];
  assert.ok(declared, "onnxruntime-web must be declared for the onnx provider to work");
});
