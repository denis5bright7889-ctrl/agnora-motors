import { NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/auth";

export const runtime = "nodejs";

// Development-only diagnostic: does Resend delivery work from this deployment?
//
// This endpoint does not exist in production. It is served only when
// NODE_ENV !== "production", and returns 404 otherwise so its presence is not
// even detectable on the live site.
//
// It previously had four problems, all fixed here and all worth naming so they
// are not reintroduced:
//
//   1. It authenticated with CRON_SECRET passed as a *query parameter*, so the
//      secret was written to every access log and proxy cache along the way.
//      Authorization is now an admin session, which is what a human diagnostic
//      should use; CRON_SECRET is for unattended cron callers.
//   2. It returned `keyPrefix: apiKey.slice(0, 8)`, leaking the first eight
//      characters of the Resend API key to the caller on both the success and
//      the error path. Nothing now reports any part of the key — only whether
//      one is configured.
//   3. `?to=` was unvalidated, so anyone holding the secret could send mail
//      from support@agnora-motors.com to an arbitrary address: an open relay
//      on a domain whose sending reputation matters. It now always sends to
//      the signed-in admin's own address and ignores any supplied recipient.
//   4. It echoed the raw provider error object, which can carry request and
//      account detail. It now returns a short message.
//
// Usage (development only):
//   GET /api/debug/email-test     — signed in as an admin

function notFound() {
  // Deliberately a bare 404, matching a route that does not exist.
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (process.env.NODE_ENV === "production") return notFound();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, step: "env_check", error: "RESEND_API_KEY is not set in this environment" },
      { status: 500 },
    );
  }

  // The recipient is the caller's own verified address, never a parameter.
  // A diagnostic has no reason to mail anyone else, and accepting a recipient
  // is what made this an open relay.
  const to = session.user.email;
  if (!to) {
    return NextResponse.json(
      { ok: false, step: "recipient", error: "This admin account has no email address on file" },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from: "Agnora Motors <support@agnora-motors.com>",
      to,
      subject: "Agnora email diagnostic test",
      html: "<p>If you see this, Resend delivery is working correctly.</p>",
    });

    return NextResponse.json({
      ok: !error,
      // Enough to diagnose delivery without reporting any credential material
      // or the provider's raw payload.
      keyConfigured: true,
      resendId: data?.id ?? null,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        step: "sdk_throw",
        keyConfigured: true,
        error: err instanceof Error ? err.message : "Send failed",
      },
      { status: 500 },
    );
  }
}
