import { logAdminAction } from "@/lib/db";
import { auth } from "@/auth";

// Thin server-side helper so every admin API route doesn't repeat
// the session lookup when writing an audit log entry.

export type AdminAction =
  | "role_change"
  | "user_deactivate"
  | "user_activate"
  | "dealer_approve"
  | "dealer_reject"
  | "seller_approve"
  | "seller_reject"
  | "impersonate_start"
  | "impersonate_end"
  | "listing_delete"
  | "listing_feature"
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
