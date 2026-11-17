import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export { cloudinary };

/**
 * Recovers the Cloudinary asset id from a delivered URL.
 *
 * Only needed for photos stored before public_id was recorded at upload time;
 * new rows carry the id the API returned, which is always authoritative.
 *
 * A delivery URL looks like:
 *   https://res.cloudinary.com/<cloud>/image/upload/<transforms...>/v123/agnora/cars/ab12cd.jpg
 * The id is everything after the version segment, minus the extension. The
 * transform segments between "upload" and the version vary and are dropped.
 *
 * Returns null when the URL is not a Cloudinary delivery URL or has no version
 * segment to anchor on — guessing is worse than skipping cleanup, because a
 * wrong id would delete an unrelated asset.
 */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let path: string;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;
    path = parsed.pathname;
  } catch {
    return null;
  }

  const segments = path.split("/").filter(Boolean);
  const uploadAt = segments.indexOf("upload");
  if (uploadAt === -1) return null;

  // Anchor on the /v<digits>/ version marker that precedes the id.
  const versionAt = segments.findIndex((s, i) => i > uploadAt && /^v\d+$/.test(s));
  if (versionAt === -1) return null;

  const idParts = segments.slice(versionAt + 1);
  if (idParts.length === 0) return null;

  const joined = idParts.join("/");
  return joined.replace(/\.[a-z0-9]+$/i, "") || null;
}

/**
 * Deletes one image asset. Resolves to true only when Cloudinary confirms the
 * asset is gone (or was already absent).
 *
 * Never throws: storage cleanup is a follow-up to a database delete that has
 * already succeeded, and a failed cleanup must not surface to the user as a
 * failed delete. A leaked asset is logged for reconciliation instead.
 */
export async function destroyImage(publicId: string | null | undefined): Promise<boolean> {
  if (!publicId) return false;
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    const ok = res?.result === "ok" || res?.result === "not found";
    if (!ok) console.warn("[cloudinary] destroy %s returned %s", publicId, res?.result);
    return ok;
  } catch (err) {
    console.error(
      "[cloudinary] destroy %s failed, asset may be orphaned:",
      publicId,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
