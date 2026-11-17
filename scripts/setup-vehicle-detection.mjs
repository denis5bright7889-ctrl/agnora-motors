// Downloads the vehicle-detection model and checks the ONNX runtime.
//
//   npm run detect:setup
//
// Detection is opt-in. Nothing here is required for the app to run: without
// it, uploads are recorded as 'unchecked' and behave exactly as they did
// before detection existed.
//
// The weights are NOT committed (.models/ is gitignored): ~14MB of binary that
// is reproducible from a URL. The runtime is not a declared dependency either,
// because it unpacks to ~145MB and would weigh on every deployment, including
// those that never enable detection.
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

const DIR = ".models";

const ASSETS = [
  {
    name: "mobilenetv2-12.onnx",
    url: "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx",
    bytes: 13964571,
    // MobileNetV2, ImageNet-1k, Apache-2.0 via the ONNX model zoo.
    what: "MobileNetV2 image classifier (13.3 MB)",
  },
  {
    name: "synset.txt",
    url: "https://raw.githubusercontent.com/onnx/models/main/validated/vision/classification/synset.txt",
    bytes: null, // small text file; size is not worth pinning
    what: "ImageNet-1k class labels (reference only)",
  },
];

mkdirSync(DIR, { recursive: true });

let failed = false;

for (const asset of ASSETS) {
  const path = `${DIR}/${asset.name}`;

  if (existsSync(path) && (asset.bytes === null || statSync(path).size === asset.bytes)) {
    console.log("  %s already present, skipping", asset.name);
    continue;
  }

  process.stdout.write(`  downloading ${asset.name} — ${asset.what} ... `);
  try {
    const res = await fetch(asset.url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    // A truncated model fails at inference time with an opaque error, so the
    // size is checked here where the message can be useful.
    if (asset.bytes !== null && buf.length !== asset.bytes) {
      throw new Error(`expected ${asset.bytes} bytes, got ${buf.length} (download truncated?)`);
    }

    writeFileSync(path, buf);
    const sha = createHash("sha256").update(buf).digest("hex").slice(0, 16);
    console.log("ok (%d KB, sha256:%s…)", Math.round(buf.length / 1024), sha);
  } catch (err) {
    failed = true;
    console.log("FAILED: %s", err instanceof Error ? err.message : err);
  }
}

// The runtime is a separate, operator-chosen install.
let runtime = false;
try {
  await import("onnxruntime-web");
  runtime = true;
} catch { /* not installed */ }

console.log("\nONNX runtime: %s", runtime ? "installed" : "NOT installed");
if (!runtime) {
  console.log("  Install it with:  npm install onnxruntime-web");
  console.log("  (~145 MB unpacked. On hosts where that does not fit in the");
  console.log("   function bundle, run the detector as a sidecar instead and");
  console.log("   point VEHICLE_CLASSIFIER_URL at it.)");
}

console.log("\nTo enable detection, set in .env.local:");
console.log("  VEHICLE_CLASSIFIER=onnx");
console.log("\nUntil that is set, uploads are recorded as 'unchecked' and nothing changes.");

process.exit(failed ? 1 : 0);
