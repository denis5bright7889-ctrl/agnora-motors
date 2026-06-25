import { NextResponse } from "next/server";
import { z } from "zod";
import { createLead } from "@/lib/leads";
import { isDbConfigured } from "@/lib/db";
import { publishEvent } from "@/lib/realtime";
import { recomputeDealerScore } from "@/lib/reputation";

export const runtime = "nodejs";

// Public endpoint — buyers are not logged in. A submitted contact form becomes
// a persisted lead that lands in the owning dealer's CRM.
const schema = z.object({
  carId: z.string().uuid("Invalid car"),
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email required"),
  phone: z.string().max(20).optional(),
  message: z.string().min(2, "Message is required").max(2000),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Messaging is unavailable right now." }, { status: 503 });
  }

  let data;
  try {
    data = schema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid request" : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await createLead({
      carId: data.carId,
      buyerName: data.name,
      buyerEmail: data.email,
      buyerPhone: data.phone ?? null,
      message: data.message,
      source: data.source,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
    }

    // Forward-compat for Phase 2.5 notifications. No buyer PII in the payload.
    publishEvent("lead_created", {
      leadId: result.id, carId: data.carId, dealerId: result.dealerId,
    }).catch(() => {});

    if (result.dealerId) void recomputeDealerScore(result.dealerId);

    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/leads]", err);
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 });
  }
}
