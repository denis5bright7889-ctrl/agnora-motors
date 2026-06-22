import { NextResponse } from "next/server";
import { decodeVin } from "@/lib/vin-decoder";

export const runtime = "nodejs";

/**
 * GET /api/vin/decode?vin=XXX
 *
 * Returns the decoded shape (year/make/model/bodyType/fuel/transmission/
 * drivetrain/engineCc/horsepower) for callers to splat into form
 * `setValue()`. "No match" is a 200 with `decoded: false`, not a 4xx — JDM
 * imports legitimately don't decode and we don't want the form to look
 * broken.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vin = (searchParams.get("vin") ?? "").trim();
  if (!vin) {
    return NextResponse.json({ error: "vin query parameter required" }, { status: 400 });
  }

  try {
    const result = await decodeVin(vin);
    // Strip raw upstream payload in production — it's only useful for
    // debugging the mapper and would balloon every response by ~30 KB.
    const body = process.env.NODE_ENV === "production"
      ? { decoded: result.decoded, source: result.source, vin: result.vin, fields: result.fields }
      : result;
    return NextResponse.json(body);
  } catch (err) {
    console.error("[GET /api/vin/decode]", err);
    return NextResponse.json({ error: "VIN decoder unavailable" }, { status: 503 });
  }
}
