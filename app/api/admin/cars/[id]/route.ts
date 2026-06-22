import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminModerateCar, adminDeleteCar, getCarByIdAdmin } from "@/lib/db";
import { auditLog, type AdminAction } from "@/lib/admin-logger";
import type { CarStatus } from "@/types";

export const runtime = "nodejs";

// PR1 admin moderation endpoint.
//
// Both PATCH and DELETE re-verify session.user.role === "admin" here even
// though proxy.ts also gates /admin/* — never trust route-level middleware
// alone for a destructive endpoint. If proxy.ts is bypassed (preview env,
// header trick), this check still holds.

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

// Maps each soft-status transition to the audit-log verb we want recorded.
// Anything not in this map is rejected as an invalid moderation status.
const STATUS_TO_ACTION: Record<string, AdminAction> = {
  active:   "listing_approve",
  hidden:   "listing_hide",
  archived: "listing_archive",
  rejected: "listing_reject",
  sold:     "listing_mark_sold",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    status?: CarStatus;
    reason?: string;
  } | null;

  if (!body || !body.status || !(body.status in STATUS_TO_ACTION)) {
    return NextResponse.json(
      { error: "Invalid payload — expected { status, reason? }" },
      { status: 400 },
    );
  }

  // Rejecting a listing without a reason leaves the seller in the dark, which
  // is the single biggest complaint in marketplaces — require a reason here.
  if (body.status === "rejected" && !body.reason?.trim()) {
    return NextResponse.json(
      { error: "Rejection requires a reason" },
      { status: 400 },
    );
  }

  const carBefore = await getCarByIdAdmin(id);
  if (!carBefore) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const reason = body.reason?.trim() || null;
  await adminModerateCar(id, session.user.id, body.status, reason);

  await auditLog({
    action:     STATUS_TO_ACTION[body.status],
    targetType: "car",
    targetId:   id,
    details:    {
      slug:      carBefore.slug,
      from:      carBefore.status,
      to:        body.status,
      reason,
      // Snapshot owner so we can answer "who got moderated" without joining later.
      dealerId:  carBefore.dealerId ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    car: { id, status: body.status, moderationReason: reason },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const carBefore = await getCarByIdAdmin(id);
  if (!carBefore) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  await adminDeleteCar(id);

  await auditLog({
    action:     "listing_delete",
    targetType: "car",
    targetId:   id,
    details:    {
      slug:     carBefore.slug,
      make:     carBefore.make,
      model:    carBefore.model,
      year:     carBefore.year,
      status:   carBefore.status,
      dealerId: carBefore.dealerId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
