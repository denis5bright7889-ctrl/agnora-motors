// Deleting a photo means deleting two things: the database row and the stored
// image behind it. Keeping that pairing in one place is the whole point of
// this module — the previous code deleted only the row, so every removed
// photo left its Cloudinary asset behind permanently.
//
// ORDERING
// The row goes first, then the asset. If the asset delete fails we are left
// with an unreferenced file (costs a little storage, visible to nobody),
// which is strictly better than the reverse: deleting the asset first and
// then failing the row delete would leave a live listing pointing at a broken
// image.

import { destroyImage, publicIdFromUrl } from "@/lib/cloudinary";
import {
  deleteCarPhoto,
  isPublicIdInUse,
  getPhotoById,
  getUploadClassifications,
  updateCarPhotoUrl,
} from "@/lib/db";

export interface PhotoDeletion {
  /** False only when the photo row did not exist. */
  deleted: boolean;
  /** True when the stored asset was removed too. */
  assetRemoved: boolean;
  /** Set when the asset was deliberately kept (still referenced, or unknown id). */
  assetKeptReason?: "still_referenced" | "unresolved_id" | "delete_failed";
}

/**
 * Deletes one photo and, when it is safe to do so, its stored asset.
 *
 * The asset is kept when another photo row still references it, or when its id
 * cannot be determined from an older row's URL. Guessing an id is worse than
 * leaking a file, because a wrong guess deletes an unrelated listing's image.
 */
export async function deletePhotoAndAsset(photoId: string): Promise<PhotoDeletion> {
  const row = await deleteCarPhoto(photoId);
  if (!row) return { deleted: false, assetRemoved: false };

  // Rows created before public_id was recorded fall back to parsing the URL.
  const publicId = row.publicId ?? publicIdFromUrl(row.url);
  if (!publicId) {
    console.warn("[photo-storage] no asset id for %s (%s); storage not cleaned", photoId, row.url);
    return { deleted: true, assetRemoved: false, assetKeptReason: "unresolved_id" };
  }

  // The row is already gone, so this counts every OTHER row.
  if (await isPublicIdInUse(publicId)) {
    return { deleted: true, assetRemoved: false, assetKeptReason: "still_referenced" };
  }

  const assetRemoved = await destroyImage(publicId);
  return assetRemoved
    ? { deleted: true, assetRemoved: true }
    : { deleted: true, assetRemoved: false, assetKeptReason: "delete_failed" };
}

/**
 * Points a photo at a newly uploaded image and retires the old asset.
 *
 * The replacement's quality assessment and asset id are read from the
 * server-recorded upload row, never from the request, so a seller cannot
 * replace a flagged photo with one that merely claims to be fine.
 *
 * The old asset is removed only after the row has been repointed, and only
 * when nothing else references it.
 */
export async function replacePhotoImage(
  photoId: string,
  newUrl: string,
  sha256?: string | null,
): Promise<void> {
  const before = await getPhotoById(photoId);
  const oldPublicId = before?.publicId ?? publicIdFromUrl(before?.url);

  const record = (await getUploadClassifications([newUrl])).get(newUrl);

  await updateCarPhotoUrl(photoId, newUrl, {
    isReplacement: true,
    sha256: sha256 ?? record?.sha256 ?? null,
    publicId: record?.publicId ?? publicIdFromUrl(newUrl),
    qualityScore: record?.qualityScore ?? null,
    qualityVerdict: record?.qualityVerdict ?? null,
    qualityDetail: record?.qualityDetail ?? null,
    width: record?.width ?? null,
    height: record?.height ?? null,
  });

  // Nothing to retire when the replacement reuses the same asset.
  if (!oldPublicId || oldPublicId === (record?.publicId ?? publicIdFromUrl(newUrl))) return;
  if (await isPublicIdInUse(oldPublicId, photoId)) return;
  await destroyImage(oldPublicId);
}
