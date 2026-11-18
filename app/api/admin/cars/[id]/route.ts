import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adminModerateCar, adminDeleteCar, getCarByIdAdmin, listCarPhotos } from "@/lib/db";
import { checkPublishRequirements, explainRefusal } from "@/lib/publish-requirements";
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
  active:    "listing_approve",
  hidden:    "listing_hide",
  archived:  "listing_archive",
  rejected:  "listing_reject",
  sold:      "listing_mark_sold",
  suspended: "listing_suspend",
};

// Transitions that take a listing public. These are the only ones that have
// to satisfy the publication requirements, and the only ones that can be
// refused for failing them.
const PUBLISHING_STATUSES = new Set<CarStatus>(["active"]);

// Transitions that require a written reason. Taking a listing down without
// one leaves the seller with no idea what to fix, and leaves the next
// moderator with no idea why it happened.
const REASON_REQUIRED = new Set<CarStatus>(["rejected", "suspended"]);

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

  // Taking a listing down without a reason leaves the seller in the dark,
  // which is the single biggest complaint in marketplaces.
  if (REASON_REQUIRED.has(body.status) && !body.reason?.trim()) {
    return NextResponse.json(
      { error: `Setting a listing to "${body.status}" requires a reason` },
      { status: 400 },
    );
  }

  const carBefore = await getCarByIdAdmin(id);
  if (!carBefore) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const reason = body.reason?.trim() || null;

  // Reinstatement is not a status write. A listing suspended because it was
  // deficient must not return to public search while it is still deficient,
  // so every publication requirement is re-checked here and the transition is
  // refused — with all the reasons at once — if any of them fails.
  if (PUBLISHING_STATUSES.has(body.status) && carBefore.status !== "active") {
    const photos = await listCarPhotos(id).catch(() => []);
    const check = checkPublishRequirements({
      description: carBefore.description,
      vin: carBefore.vin,
      photoCount: photos.length || (carBefore.images?.length ?? 0),
      approvedPhotoCount: photos.length
        ? photos.filter((p) => p.status === "approved").length
        : null,
    });

    if (!check.ok) {
      // Record the refusal: an attempt to reinstate is itself something a
      // later reviewer needs to see, and the listing stays exactly as it was.
      await auditLog({
        action:     "listing_reinstate_refused",
        targetType: "car",
        targetId:   id,
        details:    { slug: carBefore.slug, from: carBefore.status, failures: check.failures },
      });
      return NextResponse.json(
        {
          error:    explainRefusal(check),
          code:     "publish_requirements_unmet",
          failures: check.failures,
          status:   carBefore.status,
        },
        { status: 409 },
      );
    }
  }

  await adminModerateCar(id, session.user.id, body.status, reason);

  await auditLog({
    action:     body.status === "active" && carBefore.status === "suspended"
      ? "listing_reinstate"
      : STATUS_TO_ACTION[body.status],
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
