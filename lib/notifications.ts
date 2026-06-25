import { query } from "@/lib/db";

// Per-user notification feed. Event-driven and persisted (new leads today;
// reviews / complaints / listing-expiry fold in with later phases).

export type NotificationType =
  | "new_lead" | "review" | "complaint" | "listing_expiring" | "system";

export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function createNotification(
  userId: string,
  n: { type: NotificationType; title: string; body?: string; href?: string },
): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, href)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, n.type, n.title, n.body ?? null, n.href ?? null],
  );
}

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  return query<Notification>(
    `SELECT id, type, title, body, href,
            read_at AS "readAt", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function markRead(userId: string, id: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [id, userId],
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
}
