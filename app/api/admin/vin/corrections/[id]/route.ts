import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setCorrectionStatus } from "@/lib/vin-corrections";

export const runtime = "nodejs";

// Admin approves/rejects a learned VIN-correction pattern. Approved patterns
// are applied to future decodes; rejected ones are ignored (until they recur).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  await setCorrectionStatus(id, status);
  return NextResponse.json({ ok: true });
}
