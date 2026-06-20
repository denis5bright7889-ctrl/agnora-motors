// Kenya-market search aliases. Users rarely type the canonical name:
// they search "benz", "prado", "cx5", "g wagon". Expansion happens on the
// SERVER (in /api/search/suggest) so the same q string still works against
// the existing free-text car rows AND the PR1 makes/models taxonomy.

// Order matters when multiple aliases overlap (longer/multi-word first).
// Map keys are the alias the user types; values are the canonical token(s).

const ALIASES_RAW: Array<[string, string]> = [
  // Multi-word first
  ["land rover",       "Land Rover"],
  ["land cruiser",     "Land Cruiser"],
  ["g wagon",          "G-Class"],
  ["g-wagon",          "G-Class"],
  ["mercedes benz",    "Mercedes-Benz"],
  ["mercedes-benz",    "Mercedes-Benz"],
  ["range rover",      "Range Rover"],

  // Brand shortcuts
  ["benz",             "Mercedes-Benz"],
  ["merc",             "Mercedes-Benz"],
  ["mercedes",         "Mercedes-Benz"],
  ["mb",               "Mercedes-Benz"],
  ["vw",               "Volkswagen"],
  ["landrover",        "Land Rover"],
  ["beemer",           "BMW"],
  ["bimmer",           "BMW"],

  // Model shortcuts (dashes / no-spaces)
  ["gwagon",           "G-Class"],
  ["cx3",              "CX-3"],
  ["cx5",              "CX-5"],
  ["cx7",              "CX-7"],
  ["cx8",              "CX-8"],
  ["cx9",              "CX-9"],
  ["bt50",             "BT-50"],
  ["crv",              "CR-V"],
  ["cr v",             "CR-V"],
  ["hrv",              "HR-V"],
  ["hr v",             "HR-V"],
  ["mx5",              "MX-5"],
  ["rx8",              "RX-8"],
  ["xtrail",           "X-Trail"],
  ["x trail",          "X-Trail"],
  ["nx",               "NX"],
  ["rx",               "RX"],
  ["lx",               "LX"],
  ["gx",               "GX"],
  ["dmax",             "D-Max"],
  ["d max",            "D-Max"],
  ["mux",              "MU-X"],
  ["mu x",             "MU-X"],

  // Kenya colloquialisms — single-word brand call-outs that often mean a specific car
  ["prado",            "Land Cruiser Prado"],
  ["lc",               "Land Cruiser"],

  // BMW series shortcuts
  ["3-series",         "3 Series"],
  ["5-series",         "5 Series"],
  ["7-series",         "7 Series"],
];

// Sort longest-first so multi-word aliases win over single-word subsets
// (e.g. "land rover" matches before "rover" would).
const ALIASES = [...ALIASES_RAW].sort((a, b) => b[0].length - a[0].length);

/**
 * Expand alias tokens in a query string. Returns the expanded string plus
 * a list of canonical tokens it injected (used by the suggest endpoint to
 * bias matches toward the alias target).
 */
export function expandAliases(q: string): { expanded: string; canonical: string[] } {
  let expanded  = q;
  const canonical = new Set<string>();
  for (const [alias, target] of ALIASES) {
    // Word-boundary match, case-insensitive. \b doesn't play well with hyphens
    // so we use a lookaround that accepts start/end of string or whitespace.
    const re = new RegExp(`(^|\\s|[^a-z0-9])(${escapeRegex(alias)})(?=$|\\s|[^a-z0-9])`, "gi");
    if (re.test(expanded)) {
      canonical.add(target);
      expanded = expanded.replace(re, (_m, lead) => `${lead}${target}`);
    }
  }
  return { expanded: expanded.trim(), canonical: [...canonical] };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
