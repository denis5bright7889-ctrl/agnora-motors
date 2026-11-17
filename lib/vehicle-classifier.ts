// Vehicle-image classification.
//
// The marketplace must not accept arbitrary images as vehicle photos, and a
// filename proves nothing — "toyota.jpg" can be anything. The decision is made
// from the image bytes, server-side, because a client-side check is only a
// hint an attacker can skip.
//
// No classifier is bundled. This module defines the contract and the decision
// policy; a provider is plugged in through configuration. With none configured
// the pipeline degrades to "unchecked" and photos behave exactly as they do
// today — it never silently blocks a legitimate listing because ops forgot to
// set an env var.

export type ClassificationLabel = "unchecked" | "vehicle" | "not_vehicle" | "uncertain";

export interface ClassificationResult {
  label: ClassificationLabel;
  /** Confidence in `label`, 0–1. null when no classifier ran. */
  score: number | null;
  /** Provider name, recorded per photo so results stay auditable. */
  provider: string;
}

export interface VehicleClassifier {
  name: string;
  classify(input: { buffer: Buffer; mimeType: string }): Promise<ClassificationResult>;
}

// A vehicle needs to be clearly present to auto-approve, and clearly absent to
// auto-reject. Everything between goes to a human — rejecting an uncertain
// image would throw away legitimate photos (a tight interior shot, an odometer
// close-up), which is worse than a moderator glancing at it.
const ACCEPT_THRESHOLD = Number(process.env.VEHICLE_CLASSIFIER_ACCEPT ?? 0.75);
const REJECT_THRESHOLD = Number(process.env.VEHICLE_CLASSIFIER_REJECT ?? 0.85);

const UNCHECKED: ClassificationResult = { label: "unchecked", score: null, provider: "none" };

/** Used when nothing is configured: never blocks an upload. */
const noopClassifier: VehicleClassifier = {
  name: "none",
  classify: async () => UNCHECKED,
};

/**
 * Generic HTTP provider. POSTs the raw image to VEHICLE_CLASSIFIER_URL and
 * expects JSON: { label: "vehicle"|"not_vehicle", score: 0..1 }, or a
 * { labels: [{ name, confidence }] } list which is scanned for vehicle terms.
 *
 * Any vendor that can sit behind one HTTP endpoint works without touching the
 * rest of the app.
 */
function httpClassifier(url: string): VehicleClassifier {
  return {
    name: "http",
    async classify({ buffer, mimeType }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const headers: Record<string, string> = { "Content-Type": mimeType };
        if (process.env.VEHICLE_CLASSIFIER_TOKEN) {
          headers.Authorization = `Bearer ${process.env.VEHICLE_CLASSIFIER_TOKEN}`;
        }
        const res = await fetch(url, {
          method: "POST", headers, body: new Uint8Array(buffer), signal: controller.signal,
        });
        if (!res.ok) throw new Error(`classifier HTTP ${res.status}`);
        return normalise(await res.json(), "http");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

const VEHICLE_TERMS = [
  "car", "vehicle", "automobile", "truck", "van", "suv", "sedan", "hatchback",
  "pickup", "motor vehicle", "bumper", "wheel", "tire", "tyre", "windshield",
  "dashboard", "odometer", "engine", "headlamp", "headlight", "car seat",
];

function normalise(payload: unknown, provider: string): ClassificationResult {
  if (!payload || typeof payload !== "object") return UNCHECKED;
  const p = payload as Record<string, unknown>;

  if (typeof p.label === "string") {
    const score = typeof p.score === "number" ? p.score : null;
    if (p.label === "vehicle" || p.label === "not_vehicle") {
      return { label: p.label, score, provider };
    }
    return { label: "uncertain", score, provider };
  }

  if (Array.isArray(p.labels)) {
    let best = 0;
    for (const raw of p.labels) {
      if (!raw || typeof raw !== "object") continue;
      const l = raw as { name?: unknown; confidence?: unknown };
      const name = typeof l.name === "string" ? l.name.toLowerCase() : "";
      const conf = typeof l.confidence === "number" ? l.confidence : 0;
      if (VEHICLE_TERMS.some((t) => name.includes(t))) best = Math.max(best, conf);
    }
    // An empty or non-vehicle label set is weak evidence of absence, not proof,
    // so it lands on "uncertain" and a moderator decides.
    if (best >= ACCEPT_THRESHOLD) return { label: "vehicle", score: best, provider };
    return { label: "uncertain", score: best, provider };
  }

  return UNCHECKED;
}

/**
 * Local ONNX detector (lib/vehicle-detector-onnx.ts). Imported lazily so that
 * neither the model nor the ONNX runtime is loaded — or even required to
 * exist — unless this provider is actually selected.
 */
const onnxClassifier: VehicleClassifier = {
  name: "onnx",
  async classify(input) {
    const { onnxVehicleClassifier } = await import("./vehicle-detector-onnx.ts");
    return onnxVehicleClassifier.classify(input);
  },
};

let cached: VehicleClassifier | null = null;

/**
 * Provider selection, in precedence order:
 *
 *   VEHICLE_CLASSIFIER=onnx  → local ONNX model, nothing leaves the server
 *   VEHICLE_CLASSIFIER_URL   → an HTTP endpoint (e.g. the detector running as
 *                              a sidecar, for hosts too small to load the
 *                              runtime in-process)
 *   neither                  → no classification; uploads behave exactly as
 *                              they did before detection existed
 *
 * The default stays "off" deliberately. Turning detection on changes what gets
 * published, so it is an explicit operator decision, not something that
 * switches itself on because a file happens to be present.
 */
export function getVehicleClassifier(): VehicleClassifier {
  if (cached) return cached;

  const mode = (process.env.VEHICLE_CLASSIFIER ?? "").trim().toLowerCase();
  const url = process.env.VEHICLE_CLASSIFIER_URL;

  if (mode === "onnx" || mode === "local") cached = onnxClassifier;
  else if (url) cached = httpClassifier(url);
  else cached = noopClassifier;

  return cached;
}

/** Test seam: forces re-selection after the environment changes. */
export function resetVehicleClassifier(): void {
  cached = null;
}

export type PhotoDecision =
  | { action: "accept";  result: ClassificationResult }
  | { action: "review";  result: ClassificationResult }
  | { action: "reject";  result: ClassificationResult; message: string };

/**
 * Maps a classification onto what the upload pipeline should do.
 *   vehicle, confident      → accept
 *   not_vehicle, confident  → reject
 *   anything else           → accept the upload but flag it for review
 */
export function decidePhoto(result: ClassificationResult): PhotoDecision {
  if (result.label === "not_vehicle" && (result.score ?? 0) >= REJECT_THRESHOLD) {
    return {
      action: "reject",
      result,
      message: "That image doesn't appear to show a vehicle. Please upload photos of the car you're selling.",
    };
  }
  if (result.label === "vehicle" && (result.score ?? 0) >= ACCEPT_THRESHOLD) {
    return { action: "accept", result };
  }
  if (result.label === "unchecked") return { action: "accept", result };
  return { action: "review", result };
}

/** Classification never blocks an upload by failing: a provider outage degrades to review. */
export async function classifyVehicleImage(
  buffer: Buffer, mimeType: string,
): Promise<ClassificationResult> {
  const classifier = getVehicleClassifier();
  if (classifier.name === "none") return UNCHECKED;
  try {
    return await classifier.classify({ buffer, mimeType });
  } catch (err) {
    console.error("[classifier] %s failed:", classifier.name, err instanceof Error ? err.message : err);
    return { label: "uncertain", score: null, provider: classifier.name };
  }
}
