import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markRead, markAllRead } from "@/lib/notifications";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mark a single notification (by id) or all of them as read. Synthetic
// "task:*" ids (derived task-due reminders) are ignored — they aren't stored.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    await markAllRead(session.user.id);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id === "string" && UUID.test(body.id)) {
    await markRead(session.user.id, body.id);
    return NextResponse.json({ ok: true });
  }

  // Non-UUID (e.g. synthetic task reminder) — nothing to persist.
  return NextResponse.json({ ok: true });
}
