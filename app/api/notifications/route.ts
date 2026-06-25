import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId } from "@/lib/db";
import { listNotifications, countUnread, type Notification } from "@/lib/notifications";
import { getDueDealerTasks } from "@/lib/leads";

export const runtime = "nodejs";

// Current user's notification feed. Persisted notifications (e.g. new leads)
// are merged with derived "task due" reminders for dealers — the latter are
// not stored; they clear when the task is completed or rescheduled.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [items, unread] = await Promise.all([
    listNotifications(userId),
    countUnread(userId),
  ]);

  let merged: Notification[] = items;
  let unreadCount = unread;

  if (session.user.role === "dealer") {
    const dealer = await getDealerByUserId(userId);
    if (dealer) {
      const due = await getDueDealerTasks(dealer.id);
      const taskItems: Notification[] = due.map((t) => ({
        id: `task:${t.id}`,
        type: "task_due",
        title: "Task due",
        body: t.title,
        href: "/dashboard/dealer/leads",
        readAt: null,
        createdAt: t.dueAt ?? t.createdAt,
      }));
      merged = [...taskItems, ...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      unreadCount += taskItems.length;
    }
  }

  return NextResponse.json({ items: merged, unreadCount });
}
