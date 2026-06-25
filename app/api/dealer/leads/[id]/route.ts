import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId } from "@/lib/db";
import {
  getLeadById, getLeadActivity, updateLeadStatus, updateLeadNotes, isLeadStage,
} from "@/lib/leads";
import { recomputeDealerScore } from "@/lib/reputation";

export const runtime = "nodejs";

async function resolveDealer() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer) return { error: "Forbidden", status: 403 as const };
  return { dealerId: dealer.id };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;

  const lead = await getLeadById(id, ctx.dealerId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const activity = await getLeadActivity(id, ctx.dealerId);
  return NextResponse.json({ lead, activity });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveDealer();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  let lead = null;

  if (body.status !== undefined) {
    if (!isLeadStage(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    lead = await updateLeadStatus(id, ctx.dealerId, body.status);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    void recomputeDealerScore(ctx.dealerId);
  }

  if (typeof body.notes === "string") {
    lead = await updateLeadNotes(id, ctx.dealerId, body.notes.slice(0, 5000));
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  return NextResponse.json({ lead });
}
