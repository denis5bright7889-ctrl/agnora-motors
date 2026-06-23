import { logAdminAction } from "@/lib/db";
import { auth } from "@/auth";

// Thin server-side helper so every admin API route doesn't repeat
// the session lookup when writing an audit log entry.

export type AdminAction =
  | "role_change"
  | "user_deactivate"
  | "user_activate"
  | "user_suspend"
  | "user_unsuspend"
  | "user_strike"
  | "dealer_approve"
  | "dealer_reject"
  | "dealer_suspend"
  | "dealer_unsuspend"
  | "dealer_strike"
  | "seller_approve"
  | "seller_reject"
  | "impersonate_start"
  | "impersonate_end"
  | "listing_delete"
  | "listing_feature"
  | "listing_hide"
  | "listing_unhide"
  | "listing_archive"
  | "listing_approve"
  | "listing_reject"
  | "listing_mark_sold"
  | "listing_auto_hide"
  | "content_approve"
  | "content_reject"
  | "content_delete";

export async function auditLog(data: {
  action: AdminAction;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id) return;
    await logAdminAction({
      adminId:    session.user.id,
      adminEmail: session.user.email ?? "unknown",
      ...data,
    });
  } catch {
    // Logging must never crash an admin action
  }
}
