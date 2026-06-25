import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isDbConfigured, query } from "@/lib/db";
import { createComplaint, COMPLAINT_CATEGORIES } from "@/lib/trust";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

const schema = z.object({
  carId: z.string().uuid(),
  email: z.string().email().optional(),
  category: z.enum(COMPLAINT_CATEGORIES),
  detail: z.string().min(10, "Please describe the issue (min 10 characters)").max(2000),
});

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Reporting is unavailable right now." }, { status: 503 });
  }

  let data;
  try {
    data = schema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid report" : "Invalid report";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const session = await auth().catch(() => null);

  const result = await createComplaint({
    carId: data.carId,
    reporterUserId: session?.user?.id ?? null,
    reporterEmail: data.email ?? session?.user?.email ?? null,
    category: data.category,
    detail: data.detail,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "This listing no longer exists." }, { status: 404 });
  }

  // Notify the dealer (if the listing belongs to one) so they can respond.
  if (result.dealerId) {
    const owner = await query<{ userId: string }>(
      `SELECT user_id AS "userId" FROM dealers WHERE id = $1`, [result.dealerId],
    ).catch(() => []);
    if (owner[0]) {
      await createNotification(owner[0].userId, {
        type: "complaint",
        title: "New complaint filed",
        body: "A buyer reported one of your listings. Review and respond.",
        href: "/dashboard/dealer/trust",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
