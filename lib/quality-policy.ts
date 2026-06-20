// Listing-quality policy — single source of truth for the three thresholds
// that govern active listings. Lives in its own file so every enforcement
// point (insert, update, search, audit, admin metrics) imports the same
// constants. When the time comes to flip from Option A (grandfather) to
// Option B (apply to all), set QUALITY_POLICY_CUTOFF to "1970-01-01" or
// drop the grandfather branch from the search WHERE clauses — no other
// edits required.

/**
 * Listings created BEFORE this date are grandfathered: they remain visible
 * in public search even if they don't meet the photo/VIN requirements.
 * Listings created on or after this date must meet the bar to appear.
 *
 * Date is ISO 8601 (YYYY-MM-DD) so it can be passed directly as a SQL
 * `::date` parameter without timezone games.
 */
export const QUALITY_POLICY_CUTOFF = "2026-06-19";

export const MIN_PUBLISH_PHOTOS = 10;
export const MIN_VIN_LEN        = 11;
export const MAX_VIN_LEN        = 20;

/**
 * In-JS predicate matching the SQL clause we apply in buildSearchWhere.
 * Used by the static-search path so dev parity holds when DATABASE_URL
 * isn't set.
 */
export function isVisibleUnderPolicy(args: {
  createdAt:  string | null | undefined;
  photoCount: number;
  vin:        string | null | undefined;
}): boolean {
  // Grandfather branch: anything created before the cutoff is always visible.
  if (args.createdAt && args.createdAt < QUALITY_POLICY_CUTOFF) return true;

  // Post-cutoff: must clear both the photo and VIN bars.
  if (args.photoCount < MIN_PUBLISH_PHOTOS) return false;
  const v = (args.vin ?? "").trim();
  if (v.length < MIN_VIN_LEN || v.length > MAX_VIN_LEN) return false;
  return true;
}
