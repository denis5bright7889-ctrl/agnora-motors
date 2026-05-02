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
    const dealer = await createDealer({
      userId: session.user.id,
      businessName: body.businessName,
      businessReg: body.businessReg,
      kraPin: body.kraPin,
      directorName: body.directorName,
      directorIdUrl: body.directorIdUrl,
      businessCertUrl: body.businessCertUrl,
      phone: body.phone,
      location: body.location,
    });
    return NextResponse.json({ dealer }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
