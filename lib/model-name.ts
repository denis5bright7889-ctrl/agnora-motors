import { z } from "zod";

// Plausibility checks for short vehicle-identity text: model and trim.
//
// The governing constraint is from the brief and it is the right one:
// legitimate model names are weird. CX-5, GT-R, bZ4X, e-tron, i30, MX-5,
// XC90, 911, Mark X, RAV4, Vitz, Axela, SsangYong Korando. A validator that
// demands pronounceable English words would reject half the market.
//
// So this does NOT try to decide whether a name is real. It only rejects
// input that is confidently keyboard mashing, and abstains otherwise. Every
// rule below was checked against the legitimate names above before being
// added — see tests/vehicle-validation.test.ts, which pins them.
//
// This is the same posture as lib/description-quality.ts: confident reject,
// or get out of the way.

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Every 4-character run of adjacent keys, forwards and backwards. */
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

// 'y' counts as a vowel here deliberately. It makes the vowel-less rule
// strictly more cautious, which is the direction to err in.
const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

export type NameVerdict = "ok" | "reject";

export interface NameAssessment {
  verdict: NameVerdict;
  /** Seller-facing reason. Null when the verdict is "ok". */
  reason: string | null;
  /** Which rule fired — for tests and for admin review. */
  rule: "empty" | "too_long" | "keyboard_run" | "no_vowels" | "repeated_char" | null;
}

const OK: NameAssessment = { verdict: "ok", reason: null, rule: null };

/** Letters only, lowercased — digits, spaces and punctuation removed. */
function lettersOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export const NAME_MAX_LENGTH = 60;

/**
 * Judges a model or trim name.
 *
 * `label` only shapes the message ("Model"/"Trim"), never the thresholds.
 */
export function assessVehicleName(
  input: string | null | undefined,
  label: "Model" | "Trim" = "Model",
): NameAssessment {
  const value = (input ?? "").trim();

  if (value.length === 0) {
    return { verdict: "reject", reason: `${label} is required.`, rule: "empty" };
  }
  if (value.length > NAME_MAX_LENGTH) {
    return {
      verdict: "reject",
      reason: `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`,
      rule: "too_long",
    };
  }

  const letters = lettersOf(value);

  // 1. A run of four adjacent keyboard keys. This is what catches
  //    "iuytfgh7" — "iuyt" is four keys walked backwards along the top row.
  //    No real model name contains one; the shortest run is four keys, so
  //    "asd" or "poi" do not trip it.
  if (KEYBOARD_RUNS.some((run) => letters.includes(run))) {
    return {
      verdict: "reject",
      reason: `That ${label.toLowerCase()} looks like keyboard input rather than a vehicle name.`,
      rule: "keyboard_run",
    };
  }

  // 2. Five or more letters with no vowel at all. This catches
  //    "987t67ftcghj" (letters "tftcghj") while leaving every real
  //    consonant-cluster badge alone, because those are short: BRZ, GLC,
  //    CLS, SLK, GT-R, CR-V, MX-5, XC90 and bZ4X all have four letters or
  //    fewer once digits and hyphens are stripped.
  if (letters.length >= 5 && ![...letters].some((c) => VOWELS.has(c))) {
    return {
      verdict: "reject",
      reason: `That ${label.toLowerCase()} doesn't look like a vehicle name.`,
      rule: "no_vowels",
    };
  }

  // 3. The same character four or more times in a row ("aaaa", "1111").
  //    Three is left alone: "Civic Type R RRR" style trims are rare but
  //    plausible, and three repeats is not confident evidence.
  if (/(.)\1{3,}/i.test(value)) {
    return {
      verdict: "reject",
      reason: `That ${label.toLowerCase()} contains a repeated character run.`,
      rule: "repeated_char",
    };
  }

  return OK;
}

/** Required model name. */
export function modelSchema() {
  return z
    .string({ required_error: "Model required", invalid_type_error: "Model required" })
    .transform((v) => v.trim())
    .superRefine((value, ctx) => {
      const a = assessVehicleName(value, "Model");
      if (a.verdict === "reject") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: a.reason ?? "Model required" });
      }
    });
}

/**
 * Manufacturer name.
 *
 * NOT validated against the `makes` table, deliberately. That table holds 18
 * manufacturers and is missing marques that are ordinary imports in this
 * market — Daihatsu, Volvo, Jeep, Mahindra, Chery, Haval, BYD among them.
 * Using it as a reject-list would turn an incomplete reference into a
 * blocklist and refuse legitimate vehicles, which is exactly what the brief
 * forbids.
 *
 * So the table is only ever useful as an ACCEPT short-circuit: a known make
 * is certainly fine. An unknown one is judged on the same plausibility rules
 * as a model name — enough to stop "asdfghjk", which `z.string().min(1)`
 * previously accepted, without pretending to know every manufacturer on
 * earth. See isKnownMake() for the short-circuit.
 */
export function makeSchema() {
  return z
    .string({ required_error: "Make required", invalid_type_error: "Make required" })
    .transform((v) => v.trim())
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Make required" });
        return;
      }
      const a = assessVehicleName(value, "Model"); // same rules, generic wording
      if (a.verdict === "reject") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "That make doesn't look like a manufacturer name.",
        });
      }
    });
}

/**
 * Whether a make appears in the reference list. Callers use this to SKIP
 * further checks, never to reject: an unknown make is unremarkable.
 */
export function isKnownMake(value: string, knownMakes: readonly string[]): boolean {
  const needle = value.trim().toLowerCase();
  return knownMakes.some((m) => m.trim().toLowerCase() === needle);
}

/**
 * Optional trim. Blank stays blank — the brief keeps trim optional — but a
 * trim that IS supplied has to be plausible, which is how "987t67ftcghj"
 * reached the preview.
 */
export function trimSchema() {
  return z
    .string()
    .transform((v) => v.trim())
    .superRefine((value, ctx) => {
      if (value.length === 0) return; // optional: absent is fine
      const a = assessVehicleName(value, "Trim");
      if (a.verdict === "reject") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: a.reason ?? "Trim isn't valid." });
      }
    })
    .optional();
}

/**
 * Colour fields. Looser than a model name — colours are free text and
 * marketing names are endless ("Soul Red Crystal", "Nardo Grey") — but the
 * same mashing rules apply, and a length cap stops a description being
 * pasted into the box.
 */
export function colourSchema(label: string) {
  return z
    .string()
    .max(40, `${label} must be 40 characters or fewer.`)
    .transform((v) => v.trim())
    .superRefine((value, ctx) => {
      if (value.length === 0) return;
      const letters = lettersOf(value);
      if (KEYBOARD_RUNS.some((run) => letters.includes(run))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} looks like keyboard input.`,
        });
        return;
      }
      if (letters.length >= 5 && ![...letters].some((c) => VOWELS.has(c))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} doesn't look like a colour.`,
        });
      }
    })
    .optional();
}
