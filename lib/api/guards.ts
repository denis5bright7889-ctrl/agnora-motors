import type { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId, getPrivateSellerByUserId, type PrivateSeller } from "@/lib/db";
import { fail } from "./respond";
import type { Dealer } from "@/types";

// Centralised authorization for Platform API v1 — replaces the per-route
// resolveDealer() copies. Each guard returns either the resolved principal or
// a ready-to-return error response, so routes stay one-liners:
//
//   const g = await requireDealer();
//   if (!g.ok) return g.response;
//   ... use g.dealer ...

type Guard<T> = ({ ok: true } & T) | { ok: false; response: NextResponse };

export async function requireUser(): Promise<Guard<{ userId: string; role: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, response: fail("UNAUTHORIZED", "Sign in required.") };
  return { ok: true, userId: session.user.id, role: session.user.role };
}

export async function requireDealer(): Promise<Guard<{ userId: string; dealer: Dealer }>> {
  const u = await requireUser();
  if (!u.ok) return u;
  const dealer = await getDealerByUserId(u.userId);
  if (!dealer) return { ok: false, response: fail("FORBIDDEN", "Dealer account required.") };
  return { ok: true, userId: u.userId, dealer };
}

export async function requireSeller(): Promise<Guard<{ userId: string; seller: PrivateSeller }>> {
  const u = await requireUser();
  if (!u.ok) return u;
  const seller = await getPrivateSellerByUserId(u.userId);
  if (!seller) return { ok: false, response: fail("FORBIDDEN", "Seller account required.") };
  return { ok: true, userId: u.userId, seller };
}

export async function requireAdmin(): Promise<Guard<{ userId: string }>> {
  const u = await requireUser();
  if (!u.ok) return u;
  if (u.role !== "admin") return { ok: false, response: fail("FORBIDDEN", "Admin access required.") };
  return { ok: true, userId: u.userId };
}
