import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { assessImageQuality, QUALITY_CONFIG, formatAssessment } from "../lib/image-quality.ts";

// --- Fixtures --------------------------------------------------------------
// Generated rather than committed, so the suite has no binary fixtures and the
// properties under test (sharpness, exposure, size) are exact and adjustable.

const W = 1600;
const H = 1200;

/**
 * A deterministic "photograph": structured edges plus fine noise, which is
 * what a real camera frame looks like to a Laplacian-variance measure.
 */
async function photo(w = W, h = H, amplitude = 110, base = 120): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 3);
  let seed = 12345;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const noise = ((seed >> 16) % 256) / 255 - 0.5;
      const edge = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 ? 40 : -40;
      const v = Math.max(0, Math.min(255, base + edge + noise * amplitude));
      const i = (y * w + x) * 3;
      buf[i] = v;
      buf[i + 1] = v;
      buf[i + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function solid(r: number, g: number, b: number, w = W, h = H): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer();
}

// --- Valid photograph ------------------------------------------------------

test("a sharp, well-exposed photograph scores well and is accepted", async () => {
  const a = await assessImageQuality(await photo());
  assert.equal(a.isBlank, false);
  assert.equal(a.isCorrupt, false);
  assert.equal(a.width, W);
  assert.equal(a.height, H);
  assert.ok(a.score != null && a.score >= QUALITY_CONFIG.goodScore,
    `expected a good score, got ${a.score}`);
  assert.equal(a.verdict, "good");
  assert.equal(a.recommendation, null, "nothing to advise on a good photo");
});

test("every metric comes back with a rating and an explanation", async () => {
  const a = await assessImageQuality(await photo());
  for (const key of ["resolution", "sharpness", "brightness", "contrast", "exposure"] as const) {
    const m = a.metrics[key];
    assert.ok(m, `${key} missing`);
    assert.ok(["good", "acceptable", "poor"].includes(m.rating), `${key} rating invalid`);
    // The explanation is the point: a score with no "why" is not actionable.
    assert.ok(m.detail.length > 0, `${key} has no explanation`);
    assert.equal(typeof m.value, "number");
  }
});

test("formatAssessment renders the explainable block", async () => {
  const a = await assessImageQuality(await photo(640, 480, 20));
  const text = formatAssessment(a);
  assert.match(text, /^Image quality: \d+\/100/);
  assert.match(text, /- Sharpness: (Good|Acceptable|Poor)\./);
});

// --- Blank images ----------------------------------------------------------

test("a blank white image is detected and rejected", async () => {
  const a = await assessImageQuality(await solid(255, 255, 255));
  assert.equal(a.isBlank, true);
  assert.equal(a.verdict, "reject");
  assert.equal(a.score, 0);
  assert.match(a.reasons[0], /almost entirely white/);
});

test("a blank black image is detected and rejected", async () => {
  const a = await assessImageQuality(await solid(0, 0, 0));
  assert.equal(a.isBlank, true);
  assert.equal(a.verdict, "reject");
  assert.match(a.reasons[0], /almost entirely black/);
});

test("a uniformly coloured image is detected and rejected", async () => {
  for (const [r, g, b] of [[128, 128, 128], [190, 30, 30], [20, 90, 200]] as const) {
    const a = await assessImageQuality(await solid(r, g, b));
    assert.equal(a.isBlank, true, `rgb(${r},${g},${b}) should read as blank`);
    assert.equal(a.verdict, "reject");
  }
});

test("blank detection does not fire on a legitimately bright or dark photo", async () => {
  // The §5B caveat: large bright or dark areas must not be mistaken for an
  // empty image. These have real edges and tonal spread, so they must pass.
  const bright = await assessImageQuality(await photo(W, H, 60, 215));
  assert.equal(bright.isBlank, false, "a bright photo is not blank");

  const dark = await assessImageQuality(await photo(W, H, 60, 40));
  assert.equal(dark.isBlank, false, "a dark photo is not blank");
});

// --- Corrupt and disguised files ------------------------------------------

test("a truncated image is reported as corrupt, not merely low quality", async () => {
  const truncated = (await photo()).subarray(0, 400);
  const a = await assessImageQuality(truncated);
  assert.equal(a.isCorrupt, true);
  assert.equal(a.verdict, "reject");
  assert.match(a.reasons[0], /damaged|corrupt/i);
});

test("a non-image file is reported as corrupt", async () => {
  const a = await assessImageQuality(Buffer.from("#!/bin/sh\necho definitely not an image\n"));
  assert.equal(a.isCorrupt, true);
  assert.equal(a.verdict, "reject");
});

test("an empty buffer does not throw", async () => {
  const a = await assessImageQuality(Buffer.alloc(0));
  assert.equal(a.isCorrupt, true);
  assert.equal(a.verdict, "reject");
});

// --- Dimensions ------------------------------------------------------------

test("an image below the resolution floor is rejected whatever its other metrics", async () => {
  // Deliberately very sharp and well exposed: only the size disqualifies it.
  const a = await assessImageQuality(await photo(320, 240));
  assert.equal(a.width, 320);
  assert.equal(a.verdict, "reject");
  assert.match(a.reasons[0], /below the 640x480 minimum/);
  assert.match(a.recommendation ?? "", /full-size original/);
});

test("an image exactly at the floor is not rejected for size", async () => {
  const a = await assessImageQuality(await photo(QUALITY_CONFIG.minWidth, QUALITY_CONFIG.minHeight));
  assert.notEqual(a.verdict, "reject");
  assert.ok(!a.reasons.some((r) => /minimum/.test(r)));
});

test("a portrait photo is not rejected merely for being portrait", async () => {
  // Regression test for a real bug found against live site data: a genuine
  // 561x653 listing photo was rejected because the floor compared width
  // against minWidth (640), even though the image clears 640x480 when its
  // orientation is taken into account. Most phone photos are portrait, so the
  // original rule would have refused a large share of real uploads.
  const portrait = await assessImageQuality(await photo(561, 653));
  assert.notEqual(portrait.verdict, "reject", `portrait photo rejected at ${portrait.score}`);
  assert.ok(
    !portrait.reasons.some((r) => /minimum/.test(r)),
    `portrait photo flagged on resolution: ${JSON.stringify(portrait.reasons)}`,
  );

  // The same pixel dimensions the other way round must behave identically.
  const landscape = await assessImageQuality(await photo(653, 561));
  assert.equal(landscape.verdict, portrait.verdict);
});

test("the floor still rejects genuinely small images in either orientation", async () => {
  for (const [w, h] of [[320, 240], [240, 320], [700, 300], [300, 700]] as [number, number][]) {
    const a = await assessImageQuality(await photo(w, h));
    assert.equal(a.verdict, "reject", `${w}x${h} should fail the floor`);
  }
});

// --- Blur ------------------------------------------------------------------

test("blur lowers the score and is named as the reason", async () => {
  const sharpShot = await assessImageQuality(await photo());
  const blurred = await assessImageQuality(await sharp(await photo()).blur(12).jpeg().toBuffer());

  assert.ok(blurred.score! < sharpShot.score!, "a blurred photo must score lower");
  assert.equal(blurred.metrics.sharpness?.rating, "poor");
  assert.ok(
    blurred.reasons.some((r) => /sharpness/i.test(r)),
    `expected a sharpness reason, got ${JSON.stringify(blurred.reasons)}`,
  );
  assert.match(blurred.recommendation ?? "", /clearer/i);
});

test("a heavily blurred photo does not reach the acceptable band", async () => {
  const a = await assessImageQuality(await sharp(await photo()).blur(14).jpeg().toBuffer());
  assert.ok(
    a.verdict === "review" || a.verdict === "reject",
    `expected review/reject, got ${a.verdict} at ${a.score}`,
  );
});

// --- Exposure --------------------------------------------------------------

test("an overexposed photo is held for review even when sharp", async () => {
  // Regression test for a real leniency bug: exposure carries only 10% of the
  // weighted score, so a badly clipped frame could still total 70+ on the
  // strength of its sharpness and be auto-accepted.
  const a = await assessImageQuality(await sharp(await photo()).linear(2.2, 0).jpeg().toBuffer());
  assert.ok(a.metrics.exposure!.value >= QUALITY_CONFIG.clipFraction,
    `fixture should be clipped, got ${a.metrics.exposure!.value}`);
  assert.notEqual(a.verdict, "good");
  assert.notEqual(a.verdict, "acceptable");
  assert.ok(a.reasons.some((r) => /pure black or pure white/.test(r)));
});

test("an underexposed photo is flagged on brightness", async () => {
  const a = await assessImageQuality(await sharp(await photo()).linear(0.25, 0).jpeg().toBuffer());
  assert.ok(a.metrics.brightness!.value < 65, `expected a dark mean, got ${a.metrics.brightness!.value}`);
  assert.equal(a.metrics.brightness?.rating, "poor");
  assert.notEqual(a.verdict, "good");
});

// --- Duplicate detection ---------------------------------------------------

test("identical uploads produce identical SHA-256 digests", async () => {
  // This is the hash the upload route records and that car_photos dedupes on
  // (idx_car_photos_dedupe, scoped per listing).
  const a = await photo();
  const b = Buffer.from(a);
  const digest = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
  assert.equal(digest(a), digest(b));

  const different = await photo(W, H, 110, 121);
  assert.notEqual(digest(a), digest(different));
});

// --- Independence from vehicle detection ----------------------------------

test("quality scoring makes no claim about image content", async () => {
  // A sharp, well-exposed photo of something that is not a car scores high
  // here by design. The two checks must stay independent, so a high score is
  // never evidence that the subject is a vehicle.
  const a = await assessImageQuality(await photo());
  assert.equal(a.verdict, "good");
  assert.ok(!("isVehicle" in a), "quality must not express a content verdict");
});
