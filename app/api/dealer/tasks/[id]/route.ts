import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId } from "@/lib/db";
import { setTaskDone, deleteDealerTask } from "@/lib/leads";

export const runtime = "nodejs";

async function resolveDealer() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer) return { error: "Forbidden", status: 403 as const };
  return { dealerId: dealer.id };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done (boolean) required" }, { status: 400 });
  }
  await setTaskDone(id, ctx.dealerId, body.done);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;
  await deleteDealerTask(id, ctx.dealerId);
  return NextResponse.json({ ok: true });
}
