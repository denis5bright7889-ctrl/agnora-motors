import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  WHOLE_VEHICLE_CLASSES,
  VEHICLE_PART_CLASSES,
  DETECTOR_CONFIG,
} from "../lib/vehicle-detector-onnx.ts";
import { decidePhoto } from "../lib/vehicle-classifier.ts";

// ---------------------------------------------------------------------------
// Class-table guards. These need neither the model nor the ONNX runtime, so
// they always run. They are the regression guard on the one part of the
// detector that is easy to corrupt by hand-editing index lists.
// ---------------------------------------------------------------------------

test("every class index is a valid ImageNet-1k index", () => {
  for (const i of [...WHOLE_VEHICLE_CLASSES, ...VEHICLE_PART_CLASSES]) {
    assert.ok(Number.isInteger(i) && i >= 0 && i <= 999, `${i} is not a valid index`);
  }
});

test("no class is listed twice, and the two groups do not overlap", () => {
  const whole = new Set(WHOLE_VEHICLE_CLASSES);
  const parts = new Set(VEHICLE_PART_CLASSES);
  assert.equal(whole.size, WHOLE_VEHICLE_CLASSES.length, "duplicate in whole-vehicle list");
  assert.equal(parts.size, VEHICLE_PART_CLASSES.length, "duplicate in parts list");
  // Double-counting would inflate the summed probability the policy acts on.
  for (const i of parts) assert.ok(!whole.has(i), `class ${i} is in both groups`);
});

test("non-car vehicle classes stay excluded", () => {
  // These are all genuinely "vehicles" but none is a car for sale, so a photo
  // of one must not pass as a listing photo. Guards against someone widening
  // the list by keyword search and sweeping them in.
  const mustNotBeIncluded: [number, string][] = [
    [403, "aircraft carrier"],
    [404, "airliner"],
    [444, "tandem bicycle"],
    [671, "mountain bike"],
    [628, "ocean liner"],
    [829, "streetcar / tram"],
    [874, "trolleybus"],
    [705, "passenger car (rail coach)"],
    [565, "freight car"],
    [603, "horse cart"],
    [428, "wheelbarrow"],
    [571, "gas pump"],
    [704, "parking meter"],
  ];
  const all = new Set([...WHOLE_VEHICLE_CLASSES, ...VEHICLE_PART_CLASSES]);
  for (const [index, what] of mustNotBeIncluded) {
    assert.ok(!all.has(index), `${what} (${index}) must not count as a vehicle`);
  }
});

test("vehicle-part classes are present so close-up photos survive", () => {
  // Measured: a wheel close-up scores 0.007 on whole-vehicle classes and 0.976
  // on parts. Without the parts group it would be rejected outright.
  for (const [index, what] of [
    [479, "car wheel"],
    [475, "car mirror"],
    [535, "disk brake"],
    [581, "grille"],
    [685, "odometer"],
  ] as [number, string][]) {
    assert.ok(VEHICLE_PART_CLASSES.includes(index), `${what} (${index}) should count`);
  }
});

test("thresholds leave a real gap between accept and reject", () => {
  // The measured worst legitimate case (an engine bay) scored 0.303, and the
  // best non-vehicle (a building) 0.045. The reject ceiling must stay well
  // below the legitimate floor or valid photos start being refused.
  assert.ok(
    DETECTOR_CONFIG.negativeMax < DETECTOR_CONFIG.vehicleMin,
    "reject ceiling must be below the vehicle threshold",
  );
  assert.ok(
    DETECTOR_CONFIG.negativeMax <= 0.05,
    `reject ceiling ${DETECTOR_CONFIG.negativeMax} is too high; an engine bay measured 0.303`,
  );
  assert.ok(DETECTOR_CONFIG.negativeTop1Min > 0, "rejection needs positive evidence");
});

// ---------------------------------------------------------------------------
// Live-model tests. Skipped unless both the ONNX runtime and the model file
// are present, so the suite passes on a machine that has not opted in.
// ---------------------------------------------------------------------------

async function runtimeAvailable(): Promise<boolean> {
  if (!existsSync(DETECTOR_CONFIG.modelPath)) return false;
  try {
    await import(process.env.VEHICLE_ONNX_MODULE ?? "onnxruntime-web");
    return true;
  } catch {
    return false;
  }
}

const available = await runtimeAvailable();
const reason = `requires onnxruntime-web and ${DETECTOR_CONFIG.modelPath} (run: npm run detect:setup)`;

test("the detector returns a well-formed result", { skip: available ? false : reason }, async () => {
  const { detectVehicle } = await import("../lib/vehicle-detector-onnx.ts");
  const sharp = (await import("sharp")).default;

  const img = await sharp({
    create: { width: 700, height: 500, channels: 3, background: { r: 130, g: 130, b: 140 } },
  }).jpeg().toBuffer();

  const r = await detectVehicle(img);
  assert.ok(["vehicle", "not_vehicle", "uncertain"].includes(r.label));
  assert.ok(typeof r.score === "number" && r.score >= 0 && r.score <= 1);
  assert.match(r.provider, /^onnx:/);
  // The detail is what makes a decision explainable after the fact.
  assert.ok(r.detail.total >= 0 && r.detail.total <= 1);
  assert.equal(
    Math.round((r.detail.wholeVehicle + r.detail.vehicleParts) * 100),
    Math.round(r.detail.total * 100),
    "total must be the sum of its parts",
  );
  assert.ok(r.detail.top1Index >= 0 && r.detail.top1Index <= 999);
});

test("a featureless image is never auto-accepted as a vehicle", { skip: available ? false : reason }, async () => {
  const { detectVehicle } = await import("../lib/vehicle-detector-onnx.ts");
  const sharp = (await import("sharp")).default;

  for (const bg of [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }]) {
    const img = await sharp({ create: { width: 800, height: 600, channels: 3, background: bg } })
      .jpeg().toBuffer();
    const decision = decidePhoto(await detectVehicle(img));
    assert.notEqual(decision.action, "accept");
  }
});

test("detection is deterministic for the same bytes", { skip: available ? false : reason }, async () => {
  const { detectVehicle } = await import("../lib/vehicle-detector-onnx.ts");
  const sharp = (await import("sharp")).default;
  const img = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 90, g: 140, b: 60 } },
  }).jpeg().toBuffer();

  const a = await detectVehicle(img);
  const b = await detectVehicle(img);
  assert.equal(a.label, b.label);
  assert.equal(a.score, b.score);
});
