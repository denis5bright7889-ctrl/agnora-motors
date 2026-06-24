import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId } from "@/lib/db";
import { listDealerTasks, createDealerTask } from "@/lib/leads";

export const runtime = "nodejs";

async function resolveDealer() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer) return { error: "Forbidden", status: 403 as const };
  return { dealerId: dealer.id };
}

export async function GET() {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const tasks = await listDealerTasks(ctx.dealerId);
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const task = await createDealerTask(ctx.dealerId, {
    title: title.slice(0, 200),
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
  });
  return NextResponse.json({ task }, { status: 201 });
}
