import { query, logAdminAction } from "@/lib/db";

// Dealer + seller strike accumulator. Every auto-hide (PR4 sweeper) AND
// every manual admin moderation that takes a listing down records a strike
// on the listing's owner. Crossing the threshold auto-suspends them — they
// stay logged in but enforcePublishQuality() refuses new active listings
// until an admin unsuspends.
//
// Thresholds are intentionally loose for v1 — we want to learn from the
// admin logs UI (PR3) before tightening. Adjust here when you have data.
export const STRIKE_AUTO_SUSPEND_COUNT  = 3;   // 3 strikes within window
export const STRIKE_WINDOW_DAYS         = 30;

export type ActorType = "dealer" | "user";

export interface StrikeResult {
  recorded:    boolean;
  newCount:    number;
  autoSuspended: boolean;
}

// Records a strike against a dealer or private seller and returns the
// updated count. If the actor crosses STRIKE_AUTO_SUSPEND_COUNT within
// STRIKE_WINDOW_DAYS, also flips is_active=false + stamps suspended_at
// with an explanatory reason. Every step lands in admin_logs.
//
// adminId is the actor who caused the strike — usually
// "system:auto-moderator" from PR4, but admins can fire strikes manually.
export async function recordStrike(opts: {
  actorType:   ActorType;
  actorId:     string;
  reason:      string;
  adminId:     string;
  adminEmail?: string;
}): Promise<StrikeResult> {
  const { actorType, actorId, reason, adminId, adminEmail = "system@agnora-motors.com" } = opts;

  const table = actorType === "dealer" ? "dealers" : "users";

  // Single round-trip: bump counter + read recent-window count.
  const rows = await query<{ strikeCount: number; recentCount: number; alreadySuspended: boolean }>(
    `WITH bump AS (
       UPDATE ${table}
       SET strike_count   = strike_count + 1,
           last_strike_at = NOW()
       WHERE id = $1
       RETURNING strike_count, ${actorType === "dealer" ? "is_active" : "is_active"} AS is_active
     )
     SELECT
       (SELECT strike_count FROM bump)::INT AS "strikeCount",
       (SELECT COUNT(*) FROM admin_logs
         WHERE target_type = $2
           AND target_id   = $1
           AND action      = $3
           AND created_at  > NOW() - ($4 || ' days')::INTERVAL
       )::INT AS "recentCount",
       (SELECT NOT is_active FROM bump) AS "alreadySuspended"
    `,
    [actorId, actorType, `${actorType}_strike`, String(STRIKE_WINDOW_DAYS)],
  );

  const row = rows[0];
  if (!row) {
    // Actor id didn't exist — nothing to record.
    return { recorded: false, newCount: 0, autoSuspended: false };
  }

  // Audit: this strike. recentCount is BEFORE this one's logged, so the
  // effective in-window total includes +1.
  await logAdminAction({
    adminId,
    adminEmail,
    action:     `${actorType}_strike`,
    targetType: actorType,
    targetId:   actorId,
    details:    { reason, lifetimeStrikes: row.strikeCount, recentWindow: row.recentCount + 1 },
  });

  const effectiveRecent = row.recentCount + 1;
  let autoSuspended = false;

  if (!row.alreadySuspended && effectiveRecent >= STRIKE_AUTO_SUSPEND_COUNT) {
    const suspensionReason = `auto-suspended: ${effectiveRecent} strikes within ${STRIKE_WINDOW_DAYS} days (latest: ${reason})`;
    await query(
      actorType === "dealer"
        ? `UPDATE dealers SET is_active = FALSE, suspended_at = NOW(), suspension_reason = $1, updated_at = NOW() WHERE id = $2`
        : `UPDATE users   SET is_active = FALSE, suspended_at = NOW(), suspended_reason  = $1                    WHERE id = $2`,
      [suspensionReason, actorId],
    );
    await logAdminAction({
      adminId,
      adminEmail,
      action:     actorType === "dealer" ? "dealer_suspend" : "user_suspend",
      targetType: actorType,
      targetId:   actorId,
      details:    { reason: suspensionReason, source: "auto", recentStrikes: effectiveRecent },
    });
    autoSuspended = true;
  }

  return { recorded: true, newCount: row.strikeCount, autoSuspended };
}

// Resolves the owner of a car to either { dealer, id } or { user, id }.
// Cars carry both dealer_id (for dealer listings) and seller_user_id (for
// private-seller listings + login-free posts where seller_user_id is null).
// Login-free cars have no actor to strike — returns null.
export async function getCarOwner(carId: string): Promise<{ type: ActorType; id: string } | null> {
  const rows = await query<{ dealerId: string | null; sellerUserId: string | null }>(
    `SELECT dealer_id AS "dealerId", seller_user_id AS "sellerUserId"
     FROM cars WHERE id = $1 LIMIT 1`,
    [carId],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.dealerId)       return { type: "dealer", id: row.dealerId };
  if (row.sellerUserId)   return { type: "user",   id: row.sellerUserId };
  return null;
}
