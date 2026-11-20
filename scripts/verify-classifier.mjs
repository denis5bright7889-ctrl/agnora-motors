// Real-inference verification for the vehicle classifier.
//
// Mocked unit tests prove the PLUMBING — that an "unchecked" result is
// refused, that a timeout fails closed. They cannot prove the model actually
// tells a car from a sofa. This script runs the configured provider against
// real image bytes and reports what it says, so accuracy claims are grounded
// in output rather than in the fact that tests pass.
//
//   VEHICLE_CLASSIFIER=onnx node --import ./tests/helpers/register.mjs scripts/verify-classifier.mjs
//   VEHICLE_CLASSIFIER_URL=https://… node --import ./tests/helpers/register.mjs scripts/verify-classifier.mjs
//
// Optional: pass image paths to classify real photographs.
//   … scripts/verify-classifier.mjs ./photos/car1.jpg ./photos/sofa.jpg
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const sharp = (await import("sharp")).default;
const {
  classifyVehicleImage, decidePhoto, getVehicleClassifier, resetVehicleClassifier,
} = await import("@/lib/vehicle-classifier");

resetVehicleClassifier();
const provider = getVehicleClassifier();

console.log("provider selected : %s", provider.name);
console.log("VEHICLE_CLASSIFIER: %s", process.env.VEHICLE_CLASSIFIER || "(unset)");
console.log("VEHICLE_CLASSIFIER_URL set: %s", process.env.VEHICLE_CLASSIFIER_URL ? "yes" : "no");

const modelPath = process.env.VEHICLE_MODEL_PATH ?? ".models/mobilenetv2-12.onnx";
console.log("model file present: %s (%s)", existsSync(modelPath), modelPath);
console.log("");

if (provider.name === "none") {
  console.log("No classifier is configured, so there is nothing to measure.");
  console.log("With fail-closed enforcement in place this means uploads are REFUSED,");
  console.log("not silently accepted. Configure a provider to run this check.");
  process.exit(0);
}

/** Synthetic cases — these establish behaviour, not accuracy. */
async function synthetic() {
  const noise = await sharp({
    create: { width: 1024, height: 768, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 40 } },
  }).jpeg({ quality: 80 }).toBuffer();

  const flat = await sharp({
    create: { width: 1024, height: 768, channels: 3, background: { r: 120, g: 120, b: 120 } },
  }).jpeg({ quality: 80 }).toBuffer();

  return [["gaussian noise", noise], ["flat grey", flat]];
}

const cases = await synthetic();
for (const path of process.argv.slice(2)) {
  cases.push([path, await readFile(path)]);
}

const pad = (v, n) => String(v).padEnd(n);
console.log(pad("image",28) + pad("label",13) + pad("score",9) + pad("decision",11) + "ms");
console.log("-".repeat(78));

let firstCallMs = null;
for (const [label, buffer] of cases) {
  const t0 = Date.now();
  let r;
  try {
    r = await classifyVehicleImage(buffer, "image/jpeg");
  } catch (e) {
    console.log(pad(label.slice(0, 27), 28) + "ERROR " + e.message);
    continue;
  }
  const ms = Date.now() - t0;
  if (firstCallMs === null) firstCallMs = ms;
  const d = decidePhoto(r);
  console.log(
    pad(label.slice(0, 27), 28) + pad(r.label, 13)
    + pad(r.score == null ? "-" : r.score.toFixed(3), 9) + pad(d.action, 11) + ms,
  );
}

console.log("");
console.log("cold first call : %s ms (includes model load)", firstCallMs);
console.log("process rss     : %d MB", Math.round(process.memoryUsage().rss / 1024 / 1024));
console.log("");
console.log("NOTE: synthetic images establish behaviour only. Accuracy claims require");
console.log("real photographs — pass them as arguments to this script.");
