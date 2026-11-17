import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { getPhotoById, moderateCarPhoto, listCarPhotos } from "@/lib/db";
import { deletePhotoAndAsset } from "@/lib/photo-storage";
import { auditLog, type AdminAction } from "@/lib/admin-logger";

export const runtime = "nodejs";

// Per-photo moderation. Rejecting a photo removes it from the listing's public
// image array via the sync trigger — it never deletes the listing, and the
// seller can replace the photo to restore the count.

const schema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  reason: z.string().trim().max(500).optional(),
});

const ACTION: Record<string, AdminAction> = {
  approved: "photo_approved",
  rejected: "photo_rejected",
  pending:  "photo_flagged",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const authz = await requireAdmin();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { photoId } = await params;

  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // A rejection the seller can't act on is the main complaint in moderation
  // flows, so the reason is required here just as it is for whole listings.
  if (body.status === "rejected" && !body.reason?.trim()) {
    return NextResponse.json({ error: "Rejecting a photo requires a reason" }, { status: 400 });
  }

  const photo = await getPhotoById(photoId);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  await moderateCarPhoto(photoId, authz.userId, body.status, body.reason?.trim() || null);

  await auditLog({
    action:     ACTION[body.status],
    targetType: "car",
    targetId:   photo.carId,
    details:    { photoId, from: photo.status, to: body.status, reason: body.reason?.trim() ?? null },
  });

  return NextResponse.json({ photos: await listCarPhotos(photo.carId) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const authz = await requireAdmin();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { photoId } = await params;
  const photo = await getPhotoById(photoId);
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  // Removes the stored image as well, so deleting a photo does not leave an
  // orphaned file in the Cloudinary account forever.
  const outcome = await deletePhotoAndAsset(photoId);

  await auditLog({
    action:     "photo_deleted",
    targetType: "car",
    targetId:   photo.carId,
    details:    {
      photoId,
      url: photo.url,
      // Recorded so a failed storage cleanup is reconcilable later rather
      // than silently invisible.
      assetRemoved: outcome.assetRemoved,
      assetKeptReason: outcome.assetKeptReason ?? null,
    },
  });

  return NextResponse.json({ photos: await listCarPhotos(photo.carId) });
}
