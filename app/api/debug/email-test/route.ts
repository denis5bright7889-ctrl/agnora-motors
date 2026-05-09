import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

// Temporary diagnostic endpoint — DELETE after confirming email works.
// Protected by CRON_SECRET so it cannot be triggered by the public.
//
// Usage:
//   GET /api/debug/email-test?secret=<CRON_SECRET>&to=you@email.com
//
// Returns the full Resend response so you can see exactly what's failing.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: "env_check",
      error: "RESEND_API_KEY is NOT set in this Vercel environment",
    }, { status: 500 });
  }

  const to = url.searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "Pass ?to=your@email.com" }, { status: 400 });
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: "Agnora Motors <support@agnora-motors.com>",
      to,
      subject: "Agnora email diagnostic test",
      html: "<p>If you see this, Resend delivery is working correctly from Vercel.</p>",
    });

    return NextResponse.json({
      ok: !error,
      keyPrefix: apiKey.slice(0, 8) + "…",
      resendId: data?.id ?? null,
      error: error ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: "sdk_throw",
      error: String(err),
      keyPrefix: apiKey.slice(0, 8) + "…",
    }, { status: 500 });
  }
}
