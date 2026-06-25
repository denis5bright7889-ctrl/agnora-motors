import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isDbConfigured, query } from "@/lib/db";
import { createReview } from "@/lib/trust";
import { createNotification } from "@/lib/notifications";
import { recomputeDealerScore } from "@/lib/reputation";

export const runtime = "nodejs";

const schema = z.object({
  carId: z.string().uuid().optional(),
  dealerId: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  rating: z.coerce.number().min(1).max(5),
  communication: z.coerce.number().min(1).max(5).optional(),
  vehicleAccuracy: z.coerce.number().min(1).max(5).optional(),
  professionalism: z.coerce.number().min(1).max(5).optional(),
  wouldRecommend: z.boolean().optional(),
  body: z.string().max(2000).optional(),
}).refine((d) => d.carId || d.dealerId, { message: "carId or dealerId required" });

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Reviews are unavailable right now." }, { status: 503 });
  }

  let data;
  try {
    data = schema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid review" : "Invalid review";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const session = await auth().catch(() => null);

  const result = await createReview({
    carId: data.carId, dealerId: data.dealerId,
    authorUserId: session?.user?.id ?? null,
    authorName: data.name,
    rating: data.rating,
    communication: data.communication, vehicleAccuracy: data.vehicleAccuracy,
    professionalism: data.professionalism, wouldRecommend: data.wouldRecommend,
    body: data.body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "This listing can't be reviewed." }, { status: 400 });
  }

  // Refresh the cached Dealer Score so listing cards reflect the new review.
  void recomputeDealerScore(result.dealerId);

  // Notify the dealer's user.
  const owner = await query<{ userId: string }>(
    `SELECT user_id AS "userId" FROM dealers WHERE id = $1`, [result.dealerId],
  ).catch(() => []);
  if (owner[0]) {
    await createNotification(owner[0].userId, {
      type: "review",
      title: `New ${data.rating}★ review`,
      body: `${data.name} reviewed your dealership`,
      href: "/dashboard/dealer/trust",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
