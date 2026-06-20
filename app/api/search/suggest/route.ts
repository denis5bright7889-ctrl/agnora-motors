import { NextResponse } from "next/server";
import { isDbConfigured, listMakes, searchModels, searchDealers } from "@/lib/db";
import { STATIC_MAKES, STATIC_MODELS } from "@/data/makes";
import { expandAliases } from "@/lib/search-aliases";

export const runtime = "nodejs";

// Hardcoded for PR3b. PR8 sources these from search_events aggregation.
const POPULAR_SEARCHES = [
  "Toyota Prado",
  "Mercedes-Benz C-Class",
  "Toyota Harrier",
  "BMW X5",
  "Mazda CX-5",
  "Toyota Hilux",
  "Nissan X-Trail",
  "Honda CR-V",
];

const MAX_PER_GROUP = 5;
const HARD_CAP      = 8;
const MIN_Q_LEN     = 2;

export interface SuggestMake     { slug: string; name: string }
export interface SuggestModel    { slug: string; name: string; makeSlug: string; makeName: string }
export interface SuggestDealer   { id: string; businessName: string; location: string }
export interface SuggestResponse {
  query:           string;
  expanded:        string;
  makes:           SuggestMake[];
  models:          SuggestModel[];
  dealers:         SuggestDealer[];
  popularSearches: string[];
  recentSearches:  string[];   // server returns empty; client merges localStorage
}

function emptyResponse(query: string, expanded: string): SuggestResponse {
  return {
    query, expanded,
    makes: [], models: [], dealers: [],
    popularSearches: POPULAR_SEARCHES.slice(0, 5),
    recentSearches:  [],
  };
}

function ilike(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase());
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQ = (searchParams.get("q") ?? "").trim();

  if (rawQ.length < MIN_Q_LEN) {
    return NextResponse.json(emptyResponse(rawQ, rawQ));
  }

  const { expanded, canonical } = expandAliases(rawQ);

  // Compose a list of candidate substrings to match against. Order matters —
  // expanded form is the priority; the canonical alias targets are bonus
  // terms so "benz" matches "Mercedes-Benz" even though "benz" wouldn't.
  const needles = Array.from(new Set([expanded, rawQ, ...canonical].map((s) => s.trim()).filter(Boolean)));

  let makes:   SuggestMake[]   = [];
  let models:  SuggestModel[]  = [];
  let dealers: SuggestDealer[] = [];

  if (isDbConfigured()) {
    try {
      // Run all three searches in parallel. Use the first needle (expanded form)
      // for the SQL ILIKE; dedupe across needles by re-filtering in JS.
      const primary = needles[0];
      const [allMakes, modelHits, dealerHits] = await Promise.all([
        listMakes(),
        searchModels(primary, MAX_PER_GROUP * 2),
        searchDealers(primary, MAX_PER_GROUP),
      ]);

      makes = allMakes
        .filter((m) => needles.some((n) => ilike(m.name, n)))
        .slice(0, MAX_PER_GROUP);

      models = modelHits
        .map((m) => ({ slug: m.slug, name: m.name, makeSlug: m.makeSlug, makeName: m.makeName }))
        .slice(0, MAX_PER_GROUP);

      dealers = dealerHits;
    } catch (err) {
      console.error("[/api/search/suggest] DB error:", err instanceof Error ? err.message : err);
      // fall through to static
    }
  }

  // If DB path produced nothing, use static.
  if (makes.length === 0 && models.length === 0 && dealers.length === 0) {
    makes = STATIC_MAKES
      .filter((m) => needles.some((n) => ilike(m.name, n)))
      .slice(0, MAX_PER_GROUP)
      .map((m) => ({ slug: m.slug, name: m.name }));

    const slugToMake = new Map(STATIC_MAKES.map((m) => [m.id, m]));
    models = STATIC_MODELS
      .filter((m) => needles.some((n) => ilike(m.name, n)))
      .slice(0, MAX_PER_GROUP)
      .map((m) => {
        const parent = slugToMake.get(m.makeId);
        return {
          slug: m.slug, name: m.name,
          makeSlug: parent?.slug ?? "",
          makeName: parent?.name ?? "",
        };
      });

    // No static dealer fallback — dealer data only lives in the DB.
  }

  // Popular searches: include only those matching the query.
  const popularSearches = POPULAR_SEARCHES
    .filter((s) => needles.some((n) => ilike(s, n)))
    .slice(0, 4);

  // Apply hard cap across all groups to keep the dropdown short.
  let remaining = HARD_CAP;
  const cap = <T,>(arr: T[]) => { const slice = arr.slice(0, Math.max(0, remaining)); remaining -= slice.length; return slice; };
  // Prefer most specific → least specific
  const finalMakes   = cap(makes);
  const finalModels  = cap(models);
  const finalDealers = cap(dealers);
  const finalPopular = cap(popularSearches);

  return NextResponse.json({
    query:    rawQ,
    expanded: expanded === rawQ ? "" : expanded,
    makes:           finalMakes,
    models:          finalModels,
    dealers:         finalDealers,
    popularSearches: finalPopular,
    recentSearches:  [],
  } satisfies SuggestResponse);
}
