// Server-side authorization for listing and photo mutations.
//
// This app has no database-level row security — it is Postgres over a plain
// pool, not Supabase — so every ownership rule is enforced here. Route
// handlers must resolve the owner from the database by the record's id and
// compare it to the session. A seller_id or car_id arriving in a request body
// proves nothing about who may touch it.

import { auth } from "@/auth";
import { getCarOwner, getCarPhotoOwner } from "@/lib/db";

export type Denial = { ok: false; status: 401 | 403 | 404; error: string };
export type Allowed = { ok: true; userId: string; isAdmin: boolean };
export type AuthzResult = Allowed | Denial;

const UNAUTHENTICATED: Denial = { ok: false, status: 401, error: "Sign in to continue." };
const FORBIDDEN:       Denial = { ok: false, status: 403, error: "You don't have access to this listing." };
const NOT_FOUND:       Denial = { ok: false, status: 404, error: "Not found." };

export async function requireAdmin(): Promise<AuthzResult> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHENTICATED;
  if (session.user.role !== "admin") return { ok: false, status: 403, error: "Admin access required." };
  return { ok: true, userId: session.user.id, isAdmin: true };
}

/**
 * Allows the listing's owner (private seller or the dealer's user) or an admin.
 *
 * Returns 404 rather than 403 for a listing that does not exist, so probing ids
 * cannot be used to enumerate which listings are real.
 */
export async function requireListingOwner(carId: string): Promise<AuthzResult> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHENTICATED;

  const owner = await getCarOwner(carId);
  if (!owner) return NOT_FOUND;

  const isAdmin = session.user.role === "admin";
  const owns =
    (owner.sellerUserId != null && owner.sellerUserId === session.user.id) ||
    (owner.dealerUserId != null && owner.dealerUserId === session.user.id);

  if (!owns && !isAdmin) return FORBIDDEN;
  return { ok: true, userId: session.user.id, isAdmin };
}

/**
 * Same rule, resolved from a photo id. The caller never supplies the car id —
 * it is derived from the photo — so a seller cannot reach another seller's
 * photo by pairing their own car id with someone else's photo id.
 */
export async function requirePhotoOwner(
  photoId: string,
): Promise<AuthzResult & { carId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return UNAUTHENTICATED;

  const owner = await getCarPhotoOwner(photoId);
  if (!owner) return NOT_FOUND;

  const isAdmin = session.user.role === "admin";
  const owns =
    (owner.sellerUserId != null && owner.sellerUserId === session.user.id) ||
    (owner.dealerUserId != null && owner.dealerUserId === session.user.id);

  if (!owns && !isAdmin) return FORBIDDEN;
  return { ok: true, userId: session.user.id, isAdmin, carId: owner.carId };
}
