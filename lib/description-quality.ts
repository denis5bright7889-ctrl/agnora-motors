// Description quality assessment.
//
// WHY THIS EXISTS
// A live 2024 Mercedes-Benz C200 was published with this description:
//
//   "uhygby7gbygb y hgbyt67tg gy76ygt6tyg"
//
// It passed because the only validation anywhere — client and server alike —
// was `z.string().min(30)`, and that string is 36 characters. A character
// count cannot tell prose from keyboard mashing, so it was never going to
// catch this; raising the minimum would only have asked for more mashing.
//
// APPROACH
// Several cheap statistical signals, combined, with no dictionary, no model
// and no network call. The decisive one is the vowel ratio: ordinary English
// (and Swahili, which is vowel-rich) runs about 0.35-0.45 vowels per letter,
// while mashing a keyboard's home row produces almost none. The example above
// scores 0.036 — one vowel in twenty-eight letters.
//
// BIAS: toward accepting. A seller wrongly refused is a lost listing and a
// support complaint, while a poor description that slips through costs a
// moderator thirty seconds. So a confident judgement rejects, anything
// ambiguous goes to review, and nothing is refused on a single weak signal.
// Short descriptions are fine when they carry real vehicle information:
// "Clean 2015 Axio, 1500cc, one owner, full service history" is more useful
// to a buyer than three padded paragraphs.

import { z } from "zod";

export type DescriptionVerdict = "good" | "review" | "reject";

export interface DescriptionAssessment {
  /** 0-100. Higher is more plausibly a real description. */
  score: number;
  verdict: DescriptionVerdict;
  /** True when the listing may be published without a human looking. */
  acceptable: boolean;
  /** Ordered, human-readable reasons behind the verdict. */
  reasons: string[];
  /** One actionable sentence for the seller, or null when nothing is wrong. */
  recommendation: string | null;
  /** The measured signals, exposed so a moderator sees the evidence. */
  metrics: {
    length: number;
    words: number;
    vowelRatio: number;
    letterDiversity: number;
    bigramPlausibility: number;
    wordlikeFraction: number;
    repeatedWordFraction: number;
    nonLetterFraction: number;
    automotiveTerms: number;
  };
}

export const DESCRIPTION_CONFIG = {
  /** Below this the text is too short to carry information. */
  minLength: num("DESCRIPTION_MIN_LENGTH", 30),
  /** English/Swahili prose sits well above this. Mashing sits far below. */
  minVowelRatio: num("DESCRIPTION_MIN_VOWEL_RATIO", 0.2),
  /** Fraction of adjacent letter pairs that occur in real words. */
  minBigramPlausibility: num("DESCRIPTION_MIN_BIGRAM", 0.45),
  /** Fraction of tokens that look like words rather than character soup. */
  minWordlike: num("DESCRIPTION_MIN_WORDLIKE", 0.5),
  /** Above this share of repeated tokens the text is padding. */
  maxRepeatedWords: num("DESCRIPTION_MAX_REPEATED_WORDS", 0.5),
  /** Above this share of digits/symbols it is not prose. */
  maxNonLetter: num("DESCRIPTION_MAX_NONLETTER", 0.4),
  /** Score at or above which a description publishes without review. */
  goodScore: num("DESCRIPTION_SCORE_GOOD", 70),
  /** Below this the description is refused outright. */
  rejectScore: num("DESCRIPTION_SCORE_REJECT", 35),
};

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// The ~150 most frequent English bigrams, plus the vowel-heavy pairs that
// dominate Swahili. Enough to separate prose from mashing without a
// dictionary; deliberately not a spell-checker.
const COMMON_BIGRAMS = new Set((
  "th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur ca el ta la ns di fo ho pe ec pr no ct us ac ot il tr ly nc et ut ss so rs un lo wa ge ie wh ee wi em ad ol rt po we na ul ni ts mo ow pa im mi ai sh ir su id os iv ia am fi ci vi pl ig tu ev ld ry mp fe bl ab gh ap je ki ku wo za vu ji nu bu ko ri mu ta pi ga sa ya we ba ha ma na la ka da"
).split(" ").filter(Boolean));

// Terms that indicate the text is actually about a vehicle. Their presence
// lets a short description through: information density matters more than
// length. Kept to words a Kenyan listing realistically uses.
const AUTOMOTIVE_TERMS = [
  "car", "vehicle", "engine", "mileage", "km", "service", "history", "owner", "owners",
  "tyre", "tyres", "tire", "tires", "clean", "accident", "free", "automatic", "manual",
  "petrol", "diesel", "hybrid", "electric", "fuel", "transmission", "gearbox", "suspension",
  "brakes", "body", "interior", "exterior", "leather", "sunroof", "alloy", "rims",
  "import", "imported", "locally", "used", "foreign", "registered", "logbook", "insurance",
  "cc", "turbo", "drive", "driven", "condition", "maintained", "new", "model", "year",
  "seater", "boot", "ac", "aircon", "radio", "reverse", "camera", "sensors", "negotiable",
  "price", "cash", "finance", "hire", "purchase", "trade", "wheel", "wheels", "mint",
];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// QWERTY rows. Mashing a keyboard most often means dragging a finger along a
// row, which leaves runs like "asdfgh" or "qwerty" that essentially never
// occur in real words — so this is a precise signal rather than a heuristic.
// Checked in both directions, since people drag both ways.
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const KEYBOARD_RUNS: string[] = (() => {
  const runs: string[] = [];
  for (const row of KEYBOARD_ROWS) {
    const reversed = [...row].reverse().join("");
    for (const source of [row, reversed]) {
      for (let i = 0; i + 4 <= source.length; i++) runs.push(source.slice(i, i + 4));
    }
  }
  return runs;
})();

/** True when the text contains a run of four or more adjacent keyboard keys. */
function hasKeyboardRun(lower: string): boolean {
  const letters = lower.replace(/[^a-z]/g, "");
  return KEYBOARD_RUNS.some((run) => letters.includes(run));
}

/** Identifier-shaped tokens (VIN, chassis, model codes) are not misspellings. */
function looksLikeIdentifier(token: string): boolean {
  return /^[a-z]{1,4}[a-z0-9]*\d{2,}[a-z0-9]*$/.test(token) && token.length >= 4;
}

/**
 * A token is "wordlike" when it could plausibly be read aloud: it contains a
 * vowel and has no improbably long consonant run. Identifier-shaped tokens
 * are exempt, so "ZZT240" and "1500cc" are not counted against the seller.
 */
function isWordlike(token: string): boolean {
  if (token.length <= 2) return true;
  if (looksLikeIdentifier(token)) return true;
  const letters = token.replace(/[^a-z]/g, "");
  if (letters.length === 0) return false;
  if (![...letters].some((c) => VOWELS.has(c))) return false;

  let run = 0;
  for (const c of letters) {
    // 'y' acts as a vowel for the purpose of breaking consonant runs.
    if (VOWELS.has(c) || c === "y") run = 0;
    else if (++run >= 5) return false;
  }
  return true;
}

/** Detects a short unit repeated back to back, as in "gbygbygb" or "abababab". */
function hasRepeatedUnit(token: string): boolean {
  if (token.length < 6) return false;
  for (let unit = 2; unit <= 4; unit++) {
    if (token.length < unit * 3) continue;
    const head = token.slice(0, unit);
    let repeats = 1;
    for (let i = unit; i + unit <= token.length; i += unit) {
      if (token.slice(i, i + unit) === head) repeats++;
      else break;
    }
    if (repeats >= 3) return true;
  }
  return false;
}

/**
 * Assesses a listing description. Pure and synchronous: no I/O, so it is safe
 * to call inside request validation.
 */
export function assessDescription(input: string | null | undefined): DescriptionAssessment {
  const text = (input ?? "").trim();
  const reasons: string[] = [];

  const lower = text.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, "");
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);

  const vowelCount = [...letters].filter((c) => VOWELS.has(c)).length;
  const vowelRatio = letters.length ? vowelCount / letters.length : 0;
  const letterDiversity = letters.length ? new Set(letters).size / letters.length : 0;

  let bigramHits = 0;
  let bigramTotal = 0;
  for (const token of tokens) {
    const t = token.replace(/[^a-z]/g, "");
    for (let i = 0; i + 1 < t.length; i++) {
      bigramTotal++;
      if (COMMON_BIGRAMS.has(t.slice(i, i + 2))) bigramHits++;
    }
  }
  const bigramPlausibility = bigramTotal ? bigramHits / bigramTotal : 0;

  const wordlikeCount = tokens.filter(isWordlike).length;
  const wordlikeFraction = tokens.length ? wordlikeCount / tokens.length : 0;

  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const repeated = [...counts.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0);
  const repeatedWordFraction = tokens.length ? repeated / tokens.length : 0;

  const nonLetterFraction = text.length
    ? [...text].filter((c) => /[^a-zA-Z\s]/.test(c)).length / text.length
    : 0;

  const automotiveTerms = new Set(tokens.filter((t) => AUTOMOTIVE_TERMS.includes(t))).size;

  const metrics = {
    length: text.length,
    words: tokens.length,
    vowelRatio: round(vowelRatio),
    letterDiversity: round(letterDiversity),
    bigramPlausibility: round(bigramPlausibility),
    wordlikeFraction: round(wordlikeFraction),
    repeatedWordFraction: round(repeatedWordFraction),
    nonLetterFraction: round(nonLetterFraction),
    automotiveTerms,
  };

  // --- Hard structural failures, independent of the score ----------------
  if (text.length === 0) {
    return fail(metrics, ["A description is required."],
      "Tell buyers about the car: condition, service history, and why you're selling.");
  }

  if (text.length < DESCRIPTION_CONFIG.minLength) {
    return fail(metrics,
      [`The description is only ${text.length} characters. Please write at least ${DESCRIPTION_CONFIG.minLength}.`],
      "Add a sentence or two about the car's condition, mileage and service history.");
  }

  // A single character repeated, or one token repeated to fill space.
  if (/(.)\1{5,}/.test(lower)) {
    reasons.push("The description contains a long run of one repeated character.");
  }
  if (tokens.some(hasRepeatedUnit)) {
    reasons.push("The description contains a short sequence repeated over and over.");
  }
  if (hasKeyboardRun(lower)) {
    reasons.push("The description contains runs of adjacent keyboard keys, such as \"asdfgh\".");
  }
  if (tokens.length >= 4 && repeatedWordFraction >= DESCRIPTION_CONFIG.maxRepeatedWords) {
    reasons.push("Most of the description is the same word or phrase repeated.");
  }

  // --- Statistical signals ------------------------------------------------
  let score = 100;

  if (vowelRatio < DESCRIPTION_CONFIG.minVowelRatio) {
    // The strongest single signal. Real words need vowels; mashing a keyboard
    // produces consonant clusters that cannot be pronounced.
    // Squared severity: 0.17 is odd, 0.04 is not language at all, and a
    // linear penalty treated those as nearly the same.
    const severity = 1 - vowelRatio / DESCRIPTION_CONFIG.minVowelRatio;
    score -= Math.round(55 * Math.sqrt(severity) * (0.5 + 0.5 * severity) * 1.4);
    reasons.push("The text doesn't read as words — it looks like random keystrokes.");
  }

  if (bigramPlausibility < DESCRIPTION_CONFIG.minBigramPlausibility) {
    const severity = 1 - bigramPlausibility / DESCRIPTION_CONFIG.minBigramPlausibility;
    score -= Math.round(30 * severity);
    if (!reasons.some((r) => r.includes("random keystrokes"))) {
      reasons.push("The letter combinations don't match real words.");
    }
  }

  if (wordlikeFraction < DESCRIPTION_CONFIG.minWordlike) {
    score -= Math.round(25 * (1 - wordlikeFraction / DESCRIPTION_CONFIG.minWordlike));
    reasons.push("Most of the words aren't recognisable as words.");
  }

  if (nonLetterFraction > DESCRIPTION_CONFIG.maxNonLetter) {
    score -= 20;
    reasons.push("The description is mostly numbers or symbols rather than words.");
  }

  if (letters.length >= 20 && letterDiversity < 0.25) {
    score -= 15;
    reasons.push("The description uses only a handful of different letters.");
  }

  // Repetition penalties, applied after the structural checks above recorded
  // their reasons.
  if (/(.)\1{5,}/.test(lower)) score -= 25;
  if (tokens.some(hasRepeatedUnit)) score -= 25;
  if (tokens.length >= 4 && repeatedWordFraction >= DESCRIPTION_CONFIG.maxRepeatedWords) score -= 25;
  // Dragging a finger along a keyboard row is the commonest form of this
  // abuse, and no real description contains such a run.
  if (hasKeyboardRun(lower)) score -= 45;
  // Padding out the field with one or two words repeated is not a
  // description, however many characters it produces.
  if (tokens.length >= 5 && new Set(tokens).size <= 2) score -= 45;

  // Real vehicle information earns the benefit of the doubt. This is what
  // keeps a terse but genuinely useful description publishable.
  if (automotiveTerms >= 2) score += 12;
  else if (automotiveTerms === 1) score += 6;

  score = Math.max(0, Math.min(100, score));

  const verdict: DescriptionVerdict =
    score < DESCRIPTION_CONFIG.rejectScore ? "reject"
      : score < DESCRIPTION_CONFIG.goodScore ? "review"
        : "good";

  if (verdict === "good") {
    return { score, verdict, acceptable: true, reasons: [], recommendation: null, metrics };
  }

  return {
    score,
    verdict,
    // A "review" description is accepted into the system — it simply does not
    // go public unseen. Only a confident rejection refuses the submission.
    acceptable: verdict === "review",
    reasons: reasons.length ? reasons : ["The description doesn't read as a genuine description."],
    recommendation:
      "Describe the car in your own words: its condition, mileage, service history, " +
      "any faults, and why you're selling. Two or three sentences is plenty.",
    metrics,
  };
}

function fail(
  metrics: DescriptionAssessment["metrics"],
  reasons: string[],
  recommendation: string,
): DescriptionAssessment {
  return { score: 0, verdict: "reject", acceptable: false, reasons, recommendation, metrics };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** A single sentence for the seller, or null when the description is fine. */
export function describeDescriptionProblem(a: DescriptionAssessment): string | null {
  if (a.verdict === "good") return null;
  return [...a.reasons, a.recommendation].filter(Boolean).join(" ");
}

/**
 * The description field schema. Mirrors how the VIN field delegates to
 * lib/vin-validate.ts, so the seller gets the actual reason rather than one
 * generic length complaint.
 *
 * Only a confident rejection fails validation here. A "review" description is
 * allowed through so the listing can be created and queued, which is handled
 * by the route rather than by refusing the request.
 */
export function descriptionSchema() {
  return z.string().superRefine((value, ctx) => {
    const assessment = assessDescription(value);
    if (assessment.acceptable) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: describeDescriptionProblem(assessment) ?? "Please write a proper description.",
    });
  });
}
