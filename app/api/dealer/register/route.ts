import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDealer, getDealerByUserId } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getDealerByUserId(session.user.id);
  if (existing) {
    return NextResponse.json(
      { error: "Application already submitted", status: existing.status },
      { status: 409 },
    );
  }

  try {
    const body = await req.json();
    // `quick` signals the simplified "no KYC required" signup path; we
    // accept placeholder business details and auto-approve so the dealer
    // can start posting cars immediately. KYC is collected later.
    const quick = body.quick === true;
    const dealer = await createDealer({
      userId: session.user.id,
      businessName: body.businessName ?? body.directorName ?? "Dealer",
      businessReg: body.businessReg ?? "-",
      kraPin: body.kraPin ?? "-",
      directorName: body.directorName ?? "",
      directorIdUrl: body.directorIdUrl ?? "",
      businessCertUrl: body.businessCertUrl ?? "",
      phone: body.phone ?? "",
      location: body.location ?? "Other",
      status: quick ? "approved" : "pending",
    });
    return NextResponse.json({ dealer }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
