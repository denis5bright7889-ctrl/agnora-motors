import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminCarDetail } from "@/lib/db";
import { sendSellerContactEmail } from "@/lib/email";
import { auditLog } from "@/lib/admin-logger";

export const runtime = "nodejs";

// Admin → seller email about one listing. The recipient address is resolved
// server-side from the listing's owner and is never accepted from the client,
// so this endpoint cannot be used to send mail to an arbitrary address.

const schema = z.object({
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid message" : "Invalid message";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const car = await getAdminCarDetail(id);
  if (!car) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!car.sellerEmail) {
    return NextResponse.json(
      {
        error:
          "This listing has no account on file, so there is no email address to write to. Use the phone number instead.",
      },
      { status: 422 },
    );
  }

  try {
    await sendSellerContactEmail({
      to:         car.sellerEmail,
      sellerName: car.sellerName,
      subject:    body.subject,
      message:    body.message,
      replyTo:    session.user.email ?? undefined,
    });
  } catch (err) {
    console.error("[POST /api/admin/cars/:id/email]", err);
    return NextResponse.json({ error: "Could not send the email. Try again." }, { status: 502 });
  }

  // Record that contact happened and about what — but not the message body,
  // which would put seller correspondence into the admin log.
  await auditLog({
    action:     "seller_contacted",
    targetType: "car",
    targetId:   id,
    details: {
      to:      car.sellerEmail,
      subject: body.subject,
      vehicle: `${car.year} ${car.make} ${car.model}`,
    },
  });

  return NextResponse.json({ ok: true, sentTo: car.sellerEmail });
}
