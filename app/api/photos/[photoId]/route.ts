import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePhotoOwner } from "@/lib/authz";
import { listCarPhotos, updateCarPhotoUrl, getPhotoById } from "@/lib/db";
import { deletePhotoAndAsset, replacePhotoImage } from "@/lib/photo-storage";
import { cloudinaryEdit } from "@/lib/utils";

export const runtime = "nodejs";

// Single-photo operations for the owning seller (or an admin): edit, replace,
// delete. The listing is derived from the photo id — never taken from the
// request — so pairing your own car id with someone else's photo id fails.

const patchSchema = z.union([
  z.object({
    action: z.literal("edit"),
    rotate: z.number().int().min(-360).max(360).optional(),
    crop: z.object({
      x: z.number().min(0), y: z.number().min(0),
      w: z.number().positive(), h: z.number().positive(),
    }).optional(),
  }),
  z.object({
    action: z.literal("replace"),
    // The URL must be one this server issued from its own Cloudinary account.
    url: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  const authz = await requirePhotoOwner(photoId);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const photo = await getPhotoById(photoId);
  if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (body.action === "edit") {
    // Always derive from the pristine upload so repeated edits don't compound.
    const base = photo.originalUrl ?? photo.url;
    const edited = cloudinaryEdit(base, { rotate: body.rotate, crop: body.crop });
    if (!edited) {
      return NextResponse.json(
        { error: "This image can't be edited in place." },
        { status: 422 },
      );
    }
    await updateCarPhotoUrl(photoId, edited, { isReplacement: false });
  } else {
    // Refuse a URL from anywhere but our own delivery domain, otherwise a
    // listing could be made to display an arbitrary remote image.
    const host = (() => { try { return new URL(body.url).hostname; } catch { return ""; } })();
    if (host !== "res.cloudinary.com") {
      return NextResponse.json(
        { error: "Replacement must be an image uploaded through Agnora." },
        { status: 422 },
      );
    }
    // Repoints the row and retires the old stored asset, picking up the
    // quality assessment the server recorded for the new upload.
    await replacePhotoImage(photoId, body.url, body.sha256);
  }

  return NextResponse.json({ photos: await listCarPhotos(photo.carId) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  const authz = await requirePhotoOwner(photoId);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const photo = await getPhotoById(photoId);
  if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Deletes the stored image too — see lib/photo-storage.ts.
  await deletePhotoAndAsset(photoId);
  return NextResponse.json({ photos: await listCarPhotos(photo.carId) });
}
