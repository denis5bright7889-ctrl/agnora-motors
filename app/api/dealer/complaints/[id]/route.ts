import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDealerByUserId } from "@/lib/db";
import { updateComplaint, isComplaintStatus } from "@/lib/trust";
import { recomputeDealerScore } from "@/lib/reputation";

export const runtime = "nodejs";

// Dealer-side: acknowledge (under_review), respond, or mark resolved. A dealer
// cannot "dismiss" their own complaint — that's an admin adjudication.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: { status?: "under_review" | "resolved"; dealerResponse?: string } = {};
  if (body.status !== undefined) {
    if (!isComplaintStatus(body.status) || !["under_review", "resolved"].includes(body.status)) {
      return NextResponse.json({ error: "Dealers can only set under_review or resolved" }, { status: 400 });
    }
    patch.status = body.status as "under_review" | "resolved";
  }
  if (typeof body.response === "string") {
    patch.dealerResponse = body.response.slice(0, 2000);
  }
  if (patch.status === undefined && patch.dealerResponse === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const complaint = await updateComplaint(id, dealer.id, patch);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  void recomputeDealerScore(dealer.id);
  return NextResponse.json({ complaint });
}
