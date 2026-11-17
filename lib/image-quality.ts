// Explainable image-quality assessment, blank-image detection and dimension
// checks for vehicle photographs.
//
// WHY THIS EXISTS
// A listing is only as good as its photos, but "is this a good photo?" and
// "is this a photo of a car?" are two different questions. This module answers
// only the first. Vehicle detection lives in lib/vehicle-classifier.ts and the
// two run independently - a razor-sharp 4000x3000 photo of a laundry basket
// scores 95 here and is still rejected there.
//
// HOW
// sharp is already present (Next.js uses it for image optimization), so pixel
// analysis costs nothing extra. It is imported lazily and every failure path
// degrades to "unknown" rather than throwing: a quality check that cannot run
// must never block a seller from listing a car.
//
// Every metric produces a rating AND a sentence explaining it, because a bare
// "42/100" tells a seller nothing about what to re-shoot.

export type MetricRating = "good" | "acceptable" | "poor";
export type QualityVerdict = "good" | "acceptable" | "review" | "reject" | "unknown";

export type MetricKey = "resolution" | "sharpness" | "brightness" | "contrast" | "exposure";

export interface QualityMetric {
  /** Raw measured value, kept for auditing and threshold tuning. */
  value: number;
  rating: MetricRating;
  /** Human sentence shown to sellers and moderators. */
  detail: string;
}

export interface QualityAssessment {
  /** 0-100, or null when no analysis could run. */
  score: number | null;
  verdict: QualityVerdict;
  width: number | null;
  height: number | null;
  format: string | null;
  /** True when the image is effectively empty (blank page, solid fill). */
  isBlank: boolean;
  /** True when the bytes could not be decoded as an image at all. */
  isCorrupt: boolean;
  metrics: Partial<Record<MetricKey, QualityMetric>>;
  /** Ordered, human-readable reasons - the "why" behind the score. */
  reasons: string[];
  /** One actionable sentence for the seller, or null when nothing is wrong. */
  recommendation: string | null;
}

// --- Configuration ---------------------------------------------------------
// These are starting points, not universal truths, so each is overridable
// without a redeploy. They were chosen against ordinary phone-camera vehicle
// photos: even a 2016-era phone shoots ~3000x4000, so 640x480 is a
// deliberately permissive floor that still excludes thumbnails and
// screenshots of other people's listings.

const num = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const QUALITY_CONFIG = {
  /** Hard floor - below this an image is rejected outright. */
  minWidth: num("IMAGE_MIN_WIDTH", 640),
  minHeight: num("IMAGE_MIN_HEIGHT", 480),
  /** Score bands. */
  goodScore: num("IMAGE_SCORE_GOOD", 80),
  acceptableScore: num("IMAGE_SCORE_ACCEPTABLE", 60),
  reviewScore: num("IMAGE_SCORE_REVIEW", 40),
  /** Laplacian variance below this reads as blurry. */
  blurVariance: num("IMAGE_BLUR_VARIANCE", 120),
  /** Standard deviation below this reads as flat/uniform. */
  flatStdDev: num("IMAGE_FLAT_STDDEV", 12),
  /** Fraction of pixels at the extremes before exposure is "clipped". */
  clipFraction: num("IMAGE_CLIP_FRACTION", 0.25),
} as const;

/** Analysis runs at a fixed working width so sharpness is scale-independent. */
const WORK_SIZE = 512;

const UNKNOWN: QualityAssessment = {
  score: null,
  verdict: "unknown",
  width: null,
  height: null,
  format: null,
  isBlank: false,
  isCorrupt: false,
  metrics: {},
  reasons: [],
  recommendation: null,
};

// --- Metric helpers --------------------------------------------------------

/** Maps a value onto 0-100 by linear interpolation between stops. */
function curve(value: number, stops: [number, number][]): number {
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, y1] = stops[i - 1];
    const [x2, y2] = stops[i];
    if (value <= x2) return y1 + ((value - x1) / (x2 - x1)) * (y2 - y1);
  }
  return stops[stops.length - 1][1];
}

function rate(score: number): MetricRating {
  if (score >= QUALITY_CONFIG.goodScore) return "good";
  if (score >= QUALITY_CONFIG.acceptableScore) return "acceptable";
  return "poor";
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Variance of the 3x3 Laplacian - the standard blur proxy. A sharp image has
 * strong local intensity changes at edges; blur smooths them away, collapsing
 * the variance. Computed on the normalised working image so a large photo is
 * not credited with sharpness it only has because it is large.
 */
function laplacianVariance(gray: Buffer, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// --- Main entry point ------------------------------------------------------

/**
 * Assesses an image from its bytes. Never throws: unreadable bytes come back
 * as isCorrupt, and an unavailable analyser comes back as verdict "unknown".
 */
export async function assessImageQuality(buffer: Buffer): Promise<QualityAssessment> {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    // sharp unavailable (unsupported platform, pruned install). Quality
    // scoring is an enhancement, not a gate - carry on without it.
    console.warn("[image-quality] sharp unavailable; skipping assessment");
    return UNKNOWN;
  }

  // Decode metadata first. Bytes that passed magic-byte sniffing but cannot be
  // parsed here are truncated or corrupt.
  let width = 0;
  let height = 0;
  let format: string | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    format = meta.format ?? null;
    if (!width || !height) throw new Error("no dimensions");
  } catch {
    return {
      ...UNKNOWN,
      score: 0,
      verdict: "reject",
      isCorrupt: true,
      format,
      reasons: ["The image file is damaged or incomplete and could not be read."],
      recommendation: "Re-save or re-take the photo and upload it again.",
    };
  }

  // Decode to a normalised single-channel raster. rotate() honours the EXIF
  // orientation phones write, so a portrait photo is not analysed sideways.
  let gray: Buffer;
  let gw = 0;
  let gh = 0;
  try {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: WORK_SIZE, height: WORK_SIZE, fit: "inside", withoutEnlargement: true })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    gray = out.data;
    gw = out.info.width;
    gh = out.info.height;
  } catch {
    return {
      ...UNKNOWN,
      score: 0,
      verdict: "reject",
      isCorrupt: true,
      width,
      height,
      format,
      reasons: ["The image could not be decoded - the file appears to be corrupt."],
      recommendation: "Re-save or re-take the photo and upload it again.",
    };
  }

  // --- Pixel statistics, single pass --------------------------------------
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
    sum += gray[i];
  }
  const count = gray.length || 1;
  const mean = sum / count;

  let varSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - mean;
    varSum += d * d;
  }
  const stdDev = Math.sqrt(varSum / count);

  // Clipping: pixels crushed to black or blown out to white carry no detail.
  let dark = 0;
  let bright = 0;
  for (let v = 0; v <= 5; v++) dark += histogram[v];
  for (let v = 250; v <= 255; v++) bright += histogram[v];
  const clipped = (dark + bright) / count;

  // Tonal spread: how many distinct 8-level buckets are meaningfully
  // populated. A photograph fills many of them; a solid fill or a blank page
  // fills one or two.
  let occupiedBuckets = 0;
  for (let b = 0; b < 32; b++) {
    let bucket = 0;
    for (let v = b * 8; v < b * 8 + 8; v++) bucket += histogram[v];
    if (bucket / count > 0.005) occupiedBuckets++;
  }

  const sharpness = laplacianVariance(gray, gw, gh);

  // --- Blank detection ----------------------------------------------------
  // Deliberately conservative and conjunctive. A legitimate photo of a white
  // car against an overcast sky has a high mean and many bright pixels, but it
  // still has edges (bumper, glass, shadow) and a spread of tones. An image is
  // only called blank when it is flat AND featureless AND tonally narrow.
  // Requiring all three is what keeps bright and dark real photos in.
  const isBlank =
    stdDev < QUALITY_CONFIG.flatStdDev &&
    sharpness < QUALITY_CONFIG.blurVariance * 0.25 &&
    occupiedBuckets <= 3;

  if (isBlank) {
    const kind =
      mean > 225 ? "almost entirely white"
        : mean < 30 ? "almost entirely black"
          : "a single flat colour";
    return {
      score: 0,
      verdict: "reject",
      width,
      height,
      format,
      isBlank: true,
      isCorrupt: false,
      metrics: {
        brightness: {
          value: round(mean),
          rating: "poor",
          detail: `Average brightness ${round(mean)}/255.`,
        },
        contrast: {
          value: round(stdDev),
          rating: "poor",
          detail: `Almost no tonal variation (standard deviation ${round(stdDev)}).`,
        },
        sharpness: {
          value: round(sharpness),
          rating: "poor",
          detail: "No edges or detail were detected anywhere in the image.",
        },
      },
      reasons: [`The image is ${kind} and contains no discernible subject.`],
      recommendation: "Upload a photograph of the vehicle itself.",
    };
  }

  // --- Per-metric scoring -------------------------------------------------
  const megapixels = (width * height) / 1_000_000;

  const resolutionScore = curve(megapixels, [
    [0.3, 10], [0.5, 40], [1.0, 65], [2.0, 85], [5.0, 100],
  ]);
  const sharpnessScore = curve(sharpness, [
    [20, 5], [60, 30], [120, 60], [300, 85], [800, 100],
  ]);
  // Mid-tones carry the most detail; a well-exposed vehicle photo sits near
  // 110-150, so the score is driven by distance from 128.
  const brightnessScore = curve(Math.abs(mean - 128), [
    [15, 100], [35, 85], [55, 60], [80, 30], [110, 5],
  ]);
  const contrastScore = curve(stdDev, [
    [10, 10], [25, 50], [40, 75], [60, 95], [80, 100],
  ]);
  const exposureScore = curve(clipped, [
    [0.02, 100], [0.08, 85], [0.15, 65], [0.25, 40], [0.45, 10],
  ]);

  const metrics: QualityAssessment["metrics"] = {
    resolution: {
      value: round(megapixels, 2),
      rating: rate(resolutionScore),
      detail: `${width}x${height} (${round(megapixels, 1)} MP).`,
    },
    sharpness: {
      value: round(sharpness),
      rating: rate(sharpnessScore),
      detail: sharpness < QUALITY_CONFIG.blurVariance
        ? "The image looks soft or out of focus."
        : "Edges and detail are crisp.",
    },
    brightness: {
      value: round(mean),
      rating: rate(brightnessScore),
      detail: mean > 190
        ? "The photo is brighter than ideal."
        : mean < 65
          ? "The photo is darker than ideal."
          : "Overall brightness is well balanced.",
    },
    contrast: {
      value: round(stdDev),
      rating: rate(contrastScore),
      detail: stdDev < 25
        ? "The photo looks flat and washed out."
        : "Good separation between light and dark areas.",
    },
    exposure: {
      value: round(clipped, 3),
      rating: rate(exposureScore),
      detail: clipped >= QUALITY_CONFIG.clipFraction
        ? `${Math.round(clipped * 100)}% of the image is pure black or pure white, losing detail.`
        : "Highlights and shadows retain detail.",
    },
  };

  // Sharpness dominates: a blurry photo of a car is useless to a buyer, while
  // a merely small or slightly dark one is still informative.
  const score = Math.round(
    sharpnessScore * 0.35 +
    resolutionScore * 0.25 +
    contrastScore * 0.15 +
    brightnessScore * 0.15 +
    exposureScore * 0.10,
  );

  // --- Reasons, in severity order -----------------------------------------
  const reasons: string[] = [];

  // The floor is applied by LONG and SHORT side, not by width and height.
  //
  // Comparing width against minWidth assumes a landscape photo. Most phone
  // photos are portrait, so that spelling rejected images purely for their
  // orientation: a real 561x653 listing photo on this site has more pixels
  // than the 640x480 floor demands, yet failed because 561 < 640. Measuring
  // the sides by size instead makes the rule orientation-independent, which is
  // what "minimum resolution" was always meant to express.
  const floorLong = Math.max(QUALITY_CONFIG.minWidth, QUALITY_CONFIG.minHeight);
  const floorShort = Math.min(QUALITY_CONFIG.minWidth, QUALITY_CONFIG.minHeight);
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);

  const belowFloor = longSide < floorLong || shortSide < floorShort;
  if (belowFloor) {
    reasons.push(
      `Resolution ${width}x${height} is below the ${floorLong}x${floorShort} minimum ` +
      `(in either orientation).`,
    );
  }
  for (const key of ["sharpness", "exposure", "brightness", "contrast", "resolution"] as const) {
    const m = metrics[key];
    if (m && m.rating === "poor" && !(key === "resolution" && belowFloor)) {
      reasons.push(`${key[0].toUpperCase()}${key.slice(1)}: ${m.detail}`);
    }
  }

  // An image under the dimension floor is rejected regardless of how good the
  // remaining metrics are - it cannot be enlarged back into a usable photo.
  let verdict: QualityVerdict =
    belowFloor ? "reject"
      : score >= QUALITY_CONFIG.goodScore ? "good"
        : score >= QUALITY_CONFIG.acceptableScore ? "acceptable"
          : score >= QUALITY_CONFIG.reviewScore ? "review"
            : "reject";

  // Severity cap. Exposure carries only 10% of the weighted score, so a photo
  // with a quarter of its pixels crushed to black or blown to white could
  // still total 70+ on the strength of its sharpness and resolution alone.
  // Calibration showed exactly that: a 41%-clipped frame scored "acceptable".
  // Large clipped regions destroy the panels and paintwork a buyer is trying
  // to inspect, so such a photo is held for a moderator rather than being
  // auto-accepted. It is capped, never auto-rejected: a legitimate night shot
  // or a white car in snow clips too, and a human should make that call.
  if (!belowFloor && clipped >= QUALITY_CONFIG.clipFraction && verdict !== "reject") {
    verdict = "review";
    reasons.unshift(
      `${Math.round(clipped * 100)}% of the image is pure black or pure white, so detail is lost.`,
    );
  }

  return {
    score,
    verdict,
    width,
    height,
    format,
    isBlank: false,
    isCorrupt: false,
    metrics,
    reasons,
    recommendation: recommend(verdict, metrics, belowFloor, shortSide),
  };
}

function recommend(
  verdict: QualityVerdict,
  metrics: QualityAssessment["metrics"],
  belowFloor: boolean,
  minSide: number,
): string | null {
  if (belowFloor) {
    return `This photo is only ${minSide}px on its shortest side. Upload the full-size original from your camera.`;
  }
  if (verdict === "good" || verdict === "acceptable") return null;
  if (metrics.sharpness?.rating === "poor") {
    return "Upload a clearer photograph - hold the camera steady and tap to focus on the car.";
  }
  if (metrics.exposure?.rating === "poor" || metrics.brightness?.rating === "poor") {
    return "Re-shoot in even daylight, avoiding direct glare and deep shadow.";
  }
  return "Upload a clearer, higher-quality photograph of the vehicle.";
}

/** Renders an assessment as the explainable block shown in the admin UI. */
export function formatAssessment(a: QualityAssessment): string {
  if (a.score == null) return "Image quality: not assessed.";
  const lines = [`Image quality: ${a.score}/100`];
  for (const [key, m] of Object.entries(a.metrics)) {
    const label = key[0].toUpperCase() + key.slice(1);
    lines.push(`- ${label}: ${m.rating[0].toUpperCase()}${m.rating.slice(1)}.`);
  }
  if (a.recommendation) lines.push(`Recommendation: ${a.recommendation}`);
  return lines.join("\n");
}
