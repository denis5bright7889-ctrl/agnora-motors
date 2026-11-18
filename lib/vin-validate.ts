// Vehicle identifier validation: standard 17-character VINs and Japanese
// chassis/frame numbers, which are not VINs and must not be judged as if they
// were.
//
// WHY A SEPARATE MODULE
// The listing form previously applied one rule to every identifier — "11 to 20
// characters" — and reported every failure as the same thing. That conflates
// four genuinely different outcomes:
//
//   1. a malformed identifier (wrong length, illegal characters)
//   2. a well-formed VIN whose check digit does not match
//   3. a well-formed Japanese chassis number, which has no check digit at all
//   4. a well-formed identifier in a format nobody here recognises
//
// Only (1) is "invalid". (2) is suspicious but common on imports. (3) is
// perfectly valid. (4) is unknown, which is a reason for a human to look, not
// a reason to refuse the seller. Each gets its own outcome and its own message.
//
// This module validates FORM only. It never decodes, and a valid form implies
// nothing about whether a vehicle exists — decoding lives in lib/vin-decoder.ts.

// Relative rather than the usual "@/lib/..." alias: the project's test runner
// is bare `node --test`, which has no TypeScript path mapping, and this module
// needs to be unit-testable.
import { normalizeVin } from "./quality-policy.ts";

export type IdentifierKind = "vin" | "jp_chassis" | "unknown";

export type IdentifierStatus =
  /** Well-formed and every applicable check passed. */
  | "valid"
  /** Structurally wrong: length or characters. The seller must fix it. */
  | "invalid"
  /** Well-formed but something is off (e.g. check digit). Allowed, flagged. */
  | "suspect"
  /** Well-formed but in no format we can confirm. Allowed, flagged for review. */
  | "unrecognised";

export interface IdentifierValidation {
  /** Canonical storage form: uppercase alphanumerics only. */
  normalized: string;
  /** What the input appears to be. */
  kind: IdentifierKind;
  status: IdentifierStatus;
  /** True when the identifier may be stored (anything but "invalid"). */
  acceptable: boolean;
  /** True when a moderator should confirm it before the listing goes live. */
  needsReview: boolean;
  /** Specific, actionable message. Never a bare "Invalid VIN". */
  message: string | null;
  /** Check-digit outcome; null when the format has no check digit. */
  checkDigit: "pass" | "fail" | "not_applicable" | null;
  /** Manufacturer inferred from a recognised chassis prefix, when known. */
  manufacturer?: string;
}

// --- Standard VIN ----------------------------------------------------------

/** I, O and Q are excluded from the VIN alphabet to avoid 1/0 confusion. */
const VIN_FORBIDDEN = /[IOQ]/;
const VIN_ALPHABET = /^[A-HJ-NPR-Z0-9]{17}$/;

/** ISO 3779 transliteration. I, O and Q are absent by construction. */
const TRANSLITERATE: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Computes the ISO 3779 check digit (position 9) for a 17-character VIN.
 * Returns the expected character, "0"-"9" or "X".
 */
export function computeVinCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const value = /\d/.test(c) ? Number(c) : TRANSLITERATE[c];
    if (value === undefined) return "";
    sum += value * WEIGHTS[i];
  }
  const rem = sum % 11;
  return rem === 10 ? "X" : String(rem);
}

/**
 * Whether the check digit is actually mandated for this VIN.
 *
 * It is required for vehicles built for the North American market (WMI first
 * character 1-5). Elsewhere — and especially on Japanese-domestic vehicles,
 * which make up much of this marketplace's imported stock — manufacturers
 * frequently leave position 9 as a filler character. Enforcing it globally
 * would reject a large share of perfectly genuine imports, so outside North
 * America a mismatch is recorded as "suspect" rather than "invalid".
 */
function checkDigitRequired(vin: string): boolean {
  return /^[1-5]/.test(vin);
}

// --- Japanese chassis / frame numbers --------------------------------------
//
// A JDM vehicle that never entered an export market has a chassis (frame)
// number, not a 17-character VIN. The shape is a model code, then a serial:
//
//   ZVW30-1234567     Toyota Prius
//   NZE141-9012345    Toyota Corolla Axio
//   GD1-1234567       Honda Fit
//   Z33-123456        Nissan Fairlady Z
//
// The model code is 2-8 alphanumerics (commonly letters then digits, sometimes
// with a trailing letter); the serial is 5-7 digits. The separator is a hyphen
// in practice but is stripped by normalisation, so matching is done on the
// normalised string.

const JP_CHASSIS = /^([A-Z]{1,4}[A-Z0-9]{1,5}?)(\d{5,7})$/;

/**
 * Model-code prefixes that can be attributed with confidence.
 *
 * Deliberately short and conservative. Many JDM prefixes are shared between
 * manufacturers — "ZC" is a Honda Fit, a Subaru Impreza and a Suzuki Swift;
 * "GH" is both a Mazda Atenza and a Subaru Impreza; bare "BP" is a Mazda 3 and
 * a Subaru Legacy — so every ambiguous prefix is omitted rather than resolved
 * by guessing. A wrong manufacturer shown to a seller as fact is worse than
 * showing none.
 *
 * Where a collision is separable by what follows, the pattern says so: a Honda
 * Fit is GD1/GD3/GD4 (digit), while a Subaru Impreza is GDA/GDB (letter).
 *
 * An unlisted prefix still validates as a chassis number — it simply carries
 * no manufacturer claim and is routed to manual review.
 */
const JP_PREFIXES: [RegExp, string][] = [
  // Toyota / Lexus — distinctive three-letter codes.
  // ZZT is the ZZ-series platform code (ZZT231 Celica, ZZT240 Allion/Premio);
  // it is unambiguous and documented, so it is attributable.
  [/^(ZVW|NZE|ZRE|ZZE|ZZT|ZWR|ACA|ANH|AZT|GRS|GSE|JZX|JZA|NCP|NHP|KSP|MXUA|AXU|SXE|GGH|AGH|MCU|ASU|AVV|AYH)/, "Toyota"],
  // Nissan — short alphanumeric platform codes.
  [/^(Z33|Z34|K12|K13|E11|E12|J10|J11|R35|C25|C26|C27|B21|B17|Y50|Y51|V36|V37)/, "Nissan"],
  // Honda — digit-suffixed codes (separates GD1 Fit from GDA Impreza).
  [/^(GD\d|GE\d|GK\d|GP\d|FD\d|FK\d|RU\d|RW\d|CL\d|CU\d|CR\d|JF\d|GB\d)/, "Honda"],
  // Mazda — letter-suffixed codes.
  [/^(DE[A-Z]|DJ[A-Z]|BK[A-Z]|BL[A-Z]|BM[A-Z]|GJ[A-Z]|KE[A-Z]|KF[A-Z]|NB\d|NC\d|ND\d)/, "Mazda"],
  // Subaru — letter-suffixed codes.
  [/^(GD[A-Z]|GG[A-Z]|GR[A-Z]|GV[A-Z]|VA[A-Z]|VB[A-Z]|BR[A-Z]|BS[A-Z]|SH\d|SJ\d|SK\d|YA\d)/, "Subaru"],
  // Mitsubishi.
  [/^(CZ\d|CW\d|CY\d|CS\d|GF\d|V8\d|V9\d|H5\d|Z2\d)/, "Mitsubishi"],
  // Suzuki.
  [/^(MH\d|MK\d|MA\d|JB\d|JS\d|TA\d|HE2|MF\d)/, "Suzuki"],
  // Daihatsu.
  [/^(JE\d|DB\d|RP\d|HJ\d|SA\d|LA\d)/, "Daihatsu"],
];

/**
 * Attributes a manufacturer from the full normalised identifier.
 *
 * Matching the whole string rather than the regex-split model code is
 * deliberate: the split between model code and serial is ambiguous once the
 * hyphen is normalised away ("Z33123456" splits as Z3+3123456 just as validly
 * as Z33+123456), so the split must never be what attribution depends on.
 */
function attributeJapanese(normalized: string): string | undefined {
  for (const [pattern, make] of JP_PREFIXES) {
    if (pattern.test(normalized)) return make;
  }
  return undefined;
}

/**
 * Engine-family designations sellers commonly enter where the chassis number
 * belongs.
 *
 * This exists because of a real listing: a Subaru Legacy was published with
 * "EJ20-D351259" as its VIN. EJ20 is the Subaru boxer *engine* family, not a
 * chassis code — but the string is 11 characters of letters-then-digits, so it
 * satisfied both the 11-20 character publish rule and the chassis shape, and
 * was reported as a valid chassis number.
 *
 * These are documented engine families, not invented formats. A car's identity
 * cannot be derived from an engine code: millions of cars share one, so it
 * identifies nothing. The seller is told what the problem is and the listing
 * goes to review rather than being refused, because a genuine chassis code
 * could in principle collide with one of these strings.
 */
const JP_ENGINE_FAMILIES = [
  // Subaru
  "EJ15", "EJ18", "EJ20", "EJ22", "EJ25", "EZ30", "EZ36", "FA20", "FB16", "FB20", "FB25",
  // Toyota
  "4AGE", "2JZ", "1JZ", "3SGE", "3SGTE", "1ZZ", "2ZZ", "1NZ", "2NZ",
  "1UZ", "2UZ", "3UZ", "2GR", "3GR", "4GR", "1KD", "2KD",
  // Nissan
  "SR20", "RB20", "RB25", "RB26", "CA18", "VQ30", "VQ35", "VQ37",
  "VG30", "KA24", "QR20", "QR25", "HR15", "MR20", "VK56",
  // Honda
  "B16A", "B18C", "B20B", "K20A", "K24A", "F20C", "F22B", "H22A", "D15B", "D16A", "L15A", "R18A",
  // Mitsubishi
  "4G63", "4G64", "4G15", "4B11", "6G72", "6G74", "4D56", "4M40",
  // Suzuki
  "K6A", "M13A", "M15A", "F6A", "G13B",
  // Mazda
  "13B", "20B", "LFDE", "L3VE", "ZJVE", "ZYVE",
];

/**
 * True when the identifier is an engine family followed by what looks like a
 * serial, which is the shape of the mistake. Requiring the trailing digits
 * keeps a bare "EJ20" (too short to be any identifier) on the length path,
 * and stops the list matching a longer unrelated code that merely starts with
 * the same letters.
 */
function looksLikeEngineCode(normalized: string): string | undefined {
  for (const family of JP_ENGINE_FAMILIES) {
    if (new RegExp(`^${family}[A-Z]?\\d{4,7}$`).test(normalized)) return family;
  }
  return undefined;
}

// --- Entry point -----------------------------------------------------------

/**
 * Validates a vehicle identifier of any supported kind.
 *
 * Normalisation happens first and is shared with every other code path
 * (storage, duplicate detection, decoding), so "jtdkb20u1 03 12345",
 * "JTDKB20U103-12345" and "JTDKB20U10312345" are one identifier, not three.
 */
export function validateIdentifier(raw: string | null | undefined): IdentifierValidation {
  const normalized = normalizeVin(raw);

  if (normalized.length === 0) {
    return {
      normalized, kind: "unknown", status: "invalid", acceptable: false,
      needsReview: false, checkDigit: null,
      message: "Enter the vehicle's VIN or chassis number.",
    };
  }

  // Illegal characters are reported before anything else, because the length
  // of a string containing them is not meaningful.
  const original = (raw ?? "").toUpperCase();
  if (normalized.length === 17 && VIN_FORBIDDEN.test(normalized)) {
    const found = [...new Set(normalized.match(/[IOQ]/g) ?? [])].join(", ");
    return {
      normalized, kind: "vin", status: "invalid", acceptable: false,
      needsReview: false, checkDigit: null,
      message:
        `A VIN never contains the letters I, O or Q (found ${found}). ` +
        `Check whether those should be the digits 1 or 0.`,
    };
  }

  // --- 17 characters: treat as a standard VIN ------------------------------
  if (normalized.length === 17) {
    if (!VIN_ALPHABET.test(normalized)) {
      return {
        normalized, kind: "vin", status: "invalid", acceptable: false,
        needsReview: false, checkDigit: null,
        message: "This VIN contains characters that are not valid in a VIN.",
      };
    }

    const expected = computeVinCheckDigit(normalized);
    const actual = normalized[8];
    const passed = expected !== "" && expected === actual;

    if (passed) {
      return {
        normalized, kind: "vin", status: "valid", acceptable: true,
        needsReview: false, checkDigit: "pass", message: null,
      };
    }

    if (checkDigitRequired(normalized)) {
      return {
        normalized, kind: "vin", status: "invalid", acceptable: false,
        needsReview: false, checkDigit: "fail",
        message:
          `This VIN's check digit doesn't match (position 9 is "${actual}", ` +
          `expected "${expected}"). North American VINs must carry a valid ` +
          `check digit, so there is likely a typo — please re-check it against ` +
          `the vehicle.`,
      };
    }

    // Outside North America a mismatch is common and not disqualifying.
    return {
      normalized, kind: "vin", status: "suspect", acceptable: true,
      needsReview: true, checkDigit: "fail",
      message:
        "This VIN's check digit doesn't match. That is common on " +
        "Japanese-market and other imported vehicles, so the listing can " +
        "continue — we'll confirm the number during review.",
    };
  }

  // --- Engine code entered in place of a chassis number -------------------
  // Checked before the chassis shape, because an engine family followed by a
  // serial satisfies that shape while identifying no particular car.
  const engine = looksLikeEngineCode(normalized);
  if (engine) {
    return {
      normalized,
      kind: "unknown",
      status: "suspect",
      acceptable: true,
      needsReview: true,
      checkDigit: null,
      message:
        `"${engine}" is an engine code, not a chassis number — many thousands ` +
        `of cars share it, so it can't identify this vehicle. The chassis ` +
        `number is on the plate in the engine bay or door frame, and on the ` +
        `export certificate. You can continue; a moderator will confirm it.`,
    };
  }

  // --- Japanese chassis / frame number ------------------------------------
  const jp = normalized.match(JP_CHASSIS);
  if (jp && normalized.length >= 6 && normalized.length <= 14) {
    const manufacturer = attributeJapanese(normalized);

    // Only a recognised model code is reported as a valid chassis number.
    // Matching the shape alone is weak evidence: "letters then 5-7 digits"
    // also describes engine codes, part numbers and plenty of typing errors,
    // so an unattributable match is routed to a human instead of being
    // asserted as valid.
    if (!manufacturer) {
      return {
        normalized,
        kind: "jp_chassis",
        status: "unrecognised",
        acceptable: true,
        needsReview: true,
        checkDigit: "not_applicable",
        message:
          "This has the shape of a Japanese chassis number, but the model " +
          "code isn't one we recognise. You can continue — a moderator will " +
          "confirm it against the export certificate before the listing goes live.",
      };
    }

    return {
      normalized,
      kind: "jp_chassis",
      status: "valid",
      acceptable: true,
      // A chassis number cannot be checksum-verified, and it is not globally
      // unique in the way a VIN is. A recognised manufacturer code is
      // confirmation enough to publish without a manual check.
      needsReview: false,
      checkDigit: "not_applicable",
      manufacturer,
      message: null,
    };
  }

  // --- Too short or too long to be either ---------------------------------
  if (normalized.length < 6) {
    return {
      normalized, kind: "unknown", status: "invalid", acceptable: false,
      needsReview: false, checkDigit: null,
      message:
        `"${original.trim()}" is too short to be a VIN (17 characters) or a ` +
        `chassis number (at least 6). Please check the vehicle's plate or logbook.`,
    };
  }

  if (normalized.length > 20) {
    return {
      normalized, kind: "unknown", status: "invalid", acceptable: false,
      needsReview: false, checkDigit: null,
      message:
        `That identifier is ${normalized.length} characters long, which is ` +
        `longer than any VIN (17) or chassis number. Please enter just the ` +
        `VIN or chassis number, with nothing after it.`,
    };
  }

  // --- Well-formed length, unrecognised shape -----------------------------
  // Explicitly NOT reported as invalid. The seller may well have entered the
  // number correctly in a format this validator does not model yet, so it is
  // stored and queued for a human instead of being refused.
  return {
    normalized,
    kind: "unknown",
    status: "unrecognised",
    acceptable: true,
    needsReview: true,
    checkDigit: null,
    message:
      "We couldn't match this to a standard 17-character VIN or a recognised " +
      "chassis-number format. You can continue — a moderator will verify it " +
      "before the listing goes live.",
  };
}

/**
 * Convenience predicate for write paths that only need a yes/no.
 * Mirrors `acceptable` so the two can never disagree.
 */
export function isAcceptableIdentifier(raw: string | null | undefined): boolean {
  return validateIdentifier(raw).acceptable;
}
