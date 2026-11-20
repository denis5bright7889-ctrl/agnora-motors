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
 * Canonical storage form of a VIN: uppercase, alphanumerics only.
 *
 * The listing forms only apply `text-transform: uppercase`, which changes how
 * the field looks without changing what it submits — so a VIN typed on a
 * phone keyboard arrived lowercase while the same VIN pasted on a desktop
 * arrived uppercase, and the two never compared equal. Every write path
 * normalises here so VIN equality is device-independent.
 *
 * Matches the normalisation already used by the decoder (lib/vin-decoder) and
 * the corrections loop (lib/vin-corrections), so all three agree.
 */
export function normalizeVin(vin: string | null | undefined): string {
  return (vin ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Identity of a photo for duplicate-counting, derived from its URL.
 *
 * Cloudinary serves the same asset under many URLs — different transformation
 * prefixes, different extensions, a cache-busting query string. The stable
 * part is the public id, which is the last path segment with any version
 * prefix and file extension removed. For anything that isn't a recognisable
 * delivery URL we fall back to the path with the query string dropped, which
 * at minimum stops `?v=1`, `?v=2`, `?v=3` from being counted as three photos.
 */
export function photoIdentity(url: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  let path = raw.split("#")[0].split("?")[0];
  try {
    path = new URL(raw).pathname;
  } catch {
    /* relative or malformed — use the string as-is */
  }
  const last = path.split("/").filter(Boolean).pop() ?? path;
  return last.replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase();
}

/**
 * How many DISTINCT photos a listing has.
 *
 * The publish gate used `images.length`, so ten copies of one photograph
 * satisfied a ten-photo requirement — trivially, by posting the same URL ten
 * times to the API. The requirement is meant to mean "ten views of the car".
 *
 * This catches exact and near-URL duplicates. It does NOT catch the same
 * photograph uploaded twice as two separate files, which produces two
 * genuinely different public ids; that needs content hashing, and the
 * sha256 for it is already recorded at upload time (see the report).
 */
export function distinctPhotoCount(images: string[] | undefined): number {
  if (!images?.length) return 0;
  const seen = new Set<string>();
  for (const url of images) {
    const id = photoIdentity(url);
    if (id) seen.add(id);
  }
  return seen.size;
}

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
