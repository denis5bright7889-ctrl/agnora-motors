import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingOwner } from "@/lib/authz";
import { listCarPhotos, reorderCarPhotos, setPrimaryCarPhoto } from "@/lib/db";

export const runtime = "nodejs";

// Photo collection operations for one listing: read the set, reorder it, or
// choose the primary. Ownership is resolved from the listing id server-side.
//
// Lives under /api/listings rather than /api/cars because Next.js allows only
// one dynamic slug name per path position, and /api/cars/[slug] is the public
// detail route keyed by slug. Putting an id-keyed segment beside it crashed
// the dev server outright ("cannot use different slug names for the same
// dynamic path"). The split is also the right one: /api/cars is the public
// catalogue, while this is an owner/admin management endpoint.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authz = await requireListingOwner(id);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  return NextResponse.json({ photos: await listCarPhotos(id) });
}

const patchSchema = z.union([
  z.object({ action: z.literal("reorder"), photoIds: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ action: z.literal("set_primary"), photoId: z.string().uuid() }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authz = await requireListingOwner(id);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  let body;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Both writes are scoped by car_id in SQL, so ids belonging to another
  // listing silently affect nothing rather than crossing the boundary.
  if (body.action === "reorder") {
    await reorderCarPhotos(id, body.photoIds);
  } else {
    await setPrimaryCarPhoto(id, body.photoId);
  }

  return NextResponse.json({ photos: await listCarPhotos(id) });
}
