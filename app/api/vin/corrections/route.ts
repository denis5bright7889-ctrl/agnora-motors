import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { recordCorrection, vinPrefix, isCorrectableField } from "@/lib/vin-corrections";

export const runtime = "nodejs";

// Public — the sell form posts the fields a seller changed away from what the
// VIN decoder filled. Aggregated by prefix into the learning loop. Best-effort:
// never block listing creation, never throw at the caller.
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const vin = typeof body.vin === "string" ? body.vin : "";
  const prefix = vinPrefix(vin);
  if (prefix.length < 8) return NextResponse.json({ ok: true });

  // Accept { fields: { engineCc: 1400, ... } }.
  const fields = (body.fields && typeof body.fields === "object") ? body.fields : {};
  let recorded = 0;
  for (const [field, value] of Object.entries(fields)) {
    if (!isCorrectableField(field)) continue;
    if (value == null || value === "") continue;
    await recordCorrection(prefix, field, String(value)).catch(() => {});
    recorded++;
    if (recorded >= 12) break; // sanity cap
  }
  return NextResponse.json({ ok: true, recorded });
}
