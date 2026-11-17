// Local vehicle detection using a MobileNetV2 ImageNet classifier via ONNX.
//
// WHY THIS SHAPE
// The question "does this photo show a vehicle?" is answered from the image
// bytes on this server. Nothing is sent anywhere: no API key, no per-call cost,
// and no seller's photograph leaves the operator's infrastructure.
//
// MobileNetV2 is an ImageNet-1k classifier, not a car detector, so it does not
// answer the question directly. What it gives is a probability over 1000
// classes, around 35 of which are road vehicles and 5 more of which are
// vehicle parts. Summing those is a good proxy, and measuring it on real
// photographs (see the table in the commit/report) showed clean separation:
//
//   car exteriors, wheel close-up ....... 0.977 - 0.985
//   building ............................ 0.045
//   documents, dog, chair, food ......... 0.000 - 0.003
//
// IMPORTANT, and the reason the policy below is cautious: two kinds of
// perfectly legitimate listing photo score LOW, because ImageNet has no class
// for them at all —
//
//   engine bay .......................... 0.303  (top-1 "oil filter")
//   interior / dashboard ................ 0.169  (top-1 "projector")
//
// A naive "low score means not a vehicle" rule would reject those. So a low
// score alone never rejects anything here: rejection additionally requires
// positive evidence that the subject is something else. Everything in between
// is reported as uncertain and goes to a human, which is what the existing
// moderation policy in lib/vehicle-classifier.ts already does with it.

import type { ClassificationResult, VehicleClassifier } from "./vehicle-classifier.ts";

// --- ImageNet class groups -------------------------------------------------
// Indices into the standard ImageNet-1k ordering (see .models/synset.txt).

/**
 * Whole road vehicles. Deliberately excludes boats, aircraft, trains, trams,
 * trolleybuses and bicycles: none of them is a car being sold, and counting
 * them would let a photo of a tram pass as a listing photo.
 */
export const WHOLE_VEHICLE_CLASSES = [
  407, // ambulance
  408, // amphibian, amphibious vehicle
  436, // beach wagon, station wagon, estate car
  468, // cab, hack, taxi, taxicab
  511, // convertible
  555, // fire engine, fire truck
  561, // forklift
  569, // garbage truck, dustcart
  573, // go-kart
  575, // golfcart
  586, // half track
  609, // jeep, landrover
  627, // limousine, limo
  654, // minibus
  656, // minivan
  661, // Model T
  665, // moped
  670, // motor scooter, scooter
  675, // moving van
  717, // pickup, pickup truck
  734, // police van
  751, // racer, race car, racing car
  757, // recreational vehicle, RV
  779, // school bus
  803, // snowplow
  817, // sports car, sport car
  847, // tank, armored combat vehicle
  864, // tow truck, wrecker
  866, // tractor
  867, // trailer truck, articulated lorry, semi
];

/**
 * Vehicle parts. A wheel, grille, mirror, brake or odometer close-up is a
 * normal and useful listing photo, so these count as vehicle evidence even
 * though no whole car is in frame. Measured: a wheel close-up scores 0.976
 * here and would otherwise have been rejected outright.
 */
export const VEHICLE_PART_CLASSES = [
  475, // car mirror
  479, // car wheel
  535, // disk brake, disc brake
  581, // grille, radiator grille
  685, // odometer
];

// --- Configuration ---------------------------------------------------------

const num = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
};

export const DETECTOR_CONFIG = {
  modelPath: process.env.VEHICLE_MODEL_PATH ?? ".models/mobilenetv2-12.onnx",
  /** At or above this summed probability, the image is called a vehicle. */
  vehicleMin: num("VEHICLE_DETECT_MIN", 0.5),
  /**
   * Rejection needs BOTH: vehicle evidence below this, AND a confident
   * non-vehicle top-1 (below). Measured non-vehicles sat at 0.003 or less,
   * while a legitimate engine bay reached 0.303 — hence the wide gap.
   */
  negativeMax: num("VEHICLE_DETECT_NEGATIVE_MAX", 0.02),
  /** Minimum top-1 probability for that top-1 to count as positive evidence. */
  negativeTop1Min: num("VEHICLE_DETECT_TOP1_MIN", 0.25),
} as const;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const SIDE = 224;
const PIXELS = SIDE * SIDE;

// --- Runtime typing --------------------------------------------------------
// onnxruntime-web is deliberately NOT a declared dependency of this project:
// it unpacks to ~145MB, which would threaten the serverless function size
// limit for every deployment, including those that never enable detection.
// It is installed only by operators who turn detection on
// (`npm install onnxruntime-web`, or `npm run detect:setup`).
//
// So the module is described structurally here and imported through a variable
// specifier. That keeps it out of the TypeScript build graph and out of the
// bundler's static analysis, so the project compiles and deploys whether or
// not the package is present.

interface OrtTensor {
  data: ArrayLike<number>;
}
interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}
interface OrtModule {
  env: { wasm: { numThreads: number }; logLevel: string };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => OrtTensor;
  InferenceSession: {
    create(model: Uint8Array, opts?: { executionProviders: string[] }): Promise<OrtSession>;
  };
}

// --- Session cache ---------------------------------------------------------
// Loading the model costs ~300ms and inference ~80ms, so the session is
// created once per process and reused across uploads.

let sessionPromise: Promise<{ ort: OrtModule; session: OrtSession }> | null = null;

async function getSession() {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const { readFile } = await import("node:fs/promises");

    // Variable specifier: see the note above. The "node" conditional export of
    // onnxruntime-web resolves to a build that runs the WASM backend under
    // Node without a browser.
    const specifier = process.env.VEHICLE_ONNX_MODULE ?? "onnxruntime-web";
    const mod = (await import(/* webpackIgnore: true */ specifier)) as
      { default?: OrtModule } & OrtModule;
    const ort = (mod.default ?? mod) as OrtModule;

    ort.env.wasm.numThreads = 1; // serverless gives us one core; threads add no speed
    ort.env.logLevel = "error";

    const bytes = new Uint8Array(await readFile(DETECTOR_CONFIG.modelPath));
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
    return { ort, session };
  })();

  // A failed load must not be cached as a permanent failure, or one transient
  // error would disable detection for the lifetime of the process.
  sessionPromise.catch(() => { sessionPromise = null; });
  return sessionPromise;
}

// --- Inference -------------------------------------------------------------

function softmax(values: ArrayLike<number>): Float64Array {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  const out = new Float64Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const e = Math.exp(values[i] - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

/**
 * Standard ImageNet evaluation transform: cover-resize to 256 then centre-crop
 * to 224. rotate() first so a portrait phone photo is not analysed sideways,
 * and removeAlpha() so a transparent PNG does not shift the channel means.
 */
async function preprocess(buffer: Buffer, ort: OrtModule) {
  const sharp = (await import("sharp")).default;
  const { data } = await sharp(buffer)
    .rotate()
    .resize(256, 256, { fit: "cover", position: "centre" })
    .extract({ left: 16, top: 16, width: SIDE, height: SIDE })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = new Float32Array(3 * PIXELS);
  for (let i = 0; i < PIXELS; i++) {
    for (let c = 0; c < 3; c++) {
      tensor[c * PIXELS + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return new ort.Tensor("float32", tensor, [1, 3, SIDE, SIDE]);
}

export interface DetectionDetail {
  /** Summed probability across whole-vehicle classes. */
  wholeVehicle: number;
  /** Summed probability across vehicle-part classes. */
  vehicleParts: number;
  /** wholeVehicle + vehicleParts, the figure the policy acts on. */
  total: number;
  /** Highest-probability single class, whatever it is. */
  top1Index: number;
  top1Probability: number;
}

/** Runs the model and applies the labelling policy. Throws on failure. */
export async function detectVehicle(
  buffer: Buffer,
): Promise<ClassificationResult & { detail: DetectionDetail }> {
  const { ort, session } = await getSession();
  const input = await preprocess(buffer, ort);
  const output = await session.run({ [session.inputNames[0]]: input });
  const probs = softmax(output[session.outputNames[0]].data);

  let wholeVehicle = 0;
  for (const i of WHOLE_VEHICLE_CLASSES) wholeVehicle += probs[i];
  let vehicleParts = 0;
  for (const i of VEHICLE_PART_CLASSES) vehicleParts += probs[i];
  const total = wholeVehicle + vehicleParts;

  let top1Index = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top1Index]) top1Index = i;
  const top1Probability = probs[top1Index];

  const detail: DetectionDetail = {
    wholeVehicle: round(wholeVehicle),
    vehicleParts: round(vehicleParts),
    total: round(total),
    top1Index,
    top1Probability: round(top1Probability),
  };

  const provider = "onnx:mobilenetv2-12";

  // Confident vehicle.
  if (total >= DETECTOR_CONFIG.vehicleMin) {
    return { label: "vehicle", score: round(total), provider, detail };
  }

  // Confident non-vehicle. Requires positive evidence of another subject, not
  // merely weak vehicle evidence — this is what protects interior and engine
  // photos, which score low without being anything else in particular.
  const isVehicleClass =
    WHOLE_VEHICLE_CLASSES.includes(top1Index) || VEHICLE_PART_CLASSES.includes(top1Index);
  if (
    total < DETECTOR_CONFIG.negativeMax &&
    top1Probability >= DETECTOR_CONFIG.negativeTop1Min &&
    !isVehicleClass
  ) {
    // Score is confidence in the "not_vehicle" label, which is what the
    // moderation policy compares against its reject threshold.
    return { label: "not_vehicle", score: round(1 - total), provider, detail };
  }

  // Everything else: a human decides. Never auto-rejected.
  return { label: "uncertain", score: round(total), provider, detail };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** The pluggable classifier used by lib/vehicle-classifier.ts. */
export const onnxVehicleClassifier: VehicleClassifier = {
  name: "onnx",
  classify: async ({ buffer }) => detectVehicle(buffer),
};

/** True when the model file is present and loadable, for health checks. */
export async function detectorAvailable(): Promise<boolean> {
  try {
    await getSession();
    return true;
  } catch {
    return false;
  }
}
