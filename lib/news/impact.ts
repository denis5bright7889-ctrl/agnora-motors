// Deterministic Kenya-relevance scoring. No AI — explainable, free, fast.
// Scans an article's title+body for known brand and segment keywords; takes
// the max severity matched. A miss falls to "low" (renders without the
// big impact widget; saves a Haiku call upstream).
//
// Update BRAND_IMPACT when import patterns shift (e.g. BYD growing in Kenya).
// Don't try to score from popularity alone — segment matches catch stories
// that affect Kenya even when no brand is named ("Japan tightens hybrid
// export rules" → high via the "hybrid" + "regulation" segment hits).

export type ImpactScore = "high" | "medium" | "low";

export const BRAND_IMPACT: Record<string, ImpactScore> = {
  // Dominant in Kenya's used + new import market
  toyota:          "high",
  subaru:          "high",
  mazda:           "high",
  nissan:          "high",
  honda:           "high",
  suzuki:          "high",
  "mercedes-benz": "high",
  mercedes:        "high",
  bmw:             "high",
  audi:            "high",
  mitsubishi:      "high",
  isuzu:           "high",
  "land rover":    "high",
  lexus:           "high",

  // Present but smaller share
  volkswagen: "medium",
  vw:         "medium",
  ford:       "medium",
  hyundai:    "medium",
  kia:        "medium",
  peugeot:    "medium",
  renault:    "medium",
  jeep:       "medium",
  volvo:      "medium",
  porsche:    "medium",

  // EV-native or ultra-luxury — relevant only to a thin slice of buyers
  tesla:    "low",
  rivian:   "low",
  lucid:    "low",
  ferrari:  "low",
  bugatti:  "low",
  bentley:  "low",
};

const SEGMENT_IMPACT: Record<string, ImpactScore> = {
  hybrid:      "high",   // Most-imported powertrain in Kenya
  diesel:      "high",   // Pickup + SUV staple
  suv:         "high",
  pickup:      "high",
  "fuel economy": "high",
  emission:    "high",
  emissions:   "high",
  regulation:  "high",
  tariff:      "high",
  ban:         "high",
  import:      "high",
  export:      "high",

  electric:    "medium", // Growing but small share of imports
  ev:          "medium",
  battery:     "medium",
  charging:    "medium",

  concept:     "low",
  prototype:   "low",
  "f1":        "low",
  formula:     "low",
  racing:      "low",
};

const SEVERITY: Record<ImpactScore, number> = { low: 0, medium: 1, high: 2 };

// Returns the score AND the keywords that matched, so the UI can show
// "Affected: Toyota, Hybrid" without re-scanning the text.
export interface ImpactResult {
  score: ImpactScore;
  matchedBrands:   string[];
  matchedSegments: string[];
}

export function scoreArticle(title: string, body: string | null): ImpactResult {
  const haystack = `${title} ${body ?? ""}`.toLowerCase();

  const matchedBrands:   string[] = [];
  const matchedSegments: string[] = [];
  let best: ImpactScore = "low";

  for (const [keyword, score] of Object.entries(BRAND_IMPACT)) {
    if (haystack.includes(keyword)) {
      matchedBrands.push(keyword);
      if (SEVERITY[score] > SEVERITY[best]) best = score;
    }
  }
  for (const [keyword, score] of Object.entries(SEGMENT_IMPACT)) {
    if (haystack.includes(keyword)) {
      matchedSegments.push(keyword);
      if (SEVERITY[score] > SEVERITY[best]) best = score;
    }
  }

  return { score: best, matchedBrands, matchedSegments };
}
