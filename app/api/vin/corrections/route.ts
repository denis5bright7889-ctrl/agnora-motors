import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDbConfigured } from "@/lib/db";
import { recordCorrection, vinPrefix, isCorrectableField } from "@/lib/vin-corrections";

export const runtime = "nodejs";

// The sell form posts the fields a seller changed away from what the VIN
// decoder filled, aggregated by VIN prefix into the learning loop.
//
// Requires a session. This was previously public, which let anyone increment
// `times_seen` for any VIN prefix and so steer what the decoder suggests to
// future sellers — unauthenticated influence over data other people rely on.
// Requiring a session costs nothing: the only caller is /sell/new, which is
// already behind authentication and email verification, and that call is
// fire-and-forget, so a rejection can never interrupt publishing.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

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
