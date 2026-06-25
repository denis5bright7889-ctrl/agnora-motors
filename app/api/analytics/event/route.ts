import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createHash } from "node:crypto";
import { isDbConfigured, insertAnalyticsEvent } from "@/lib/db";

export const runtime = "nodejs";

// PR8: persist client-fired analytics events.
//   - JSONB props field accepts arbitrary fields per event type (no migration
//     needed when the client adds new properties).
//   - ip_hash + session_hash are sha-256 truncated; we never store raw IPs.
//   - The endpoint must NEVER throw a 4xx/5xx for malformed payloads. Failed
//     writes turn into a 204 No Content so the client tracker stays silent.

const HASH_SALT      = process.env.ANALYTICS_SALT ?? "agnora-analytics";
const MAX_NAME_LEN   = 64;
const MAX_PROPS_BYTES = 4_096; // light cap, defends the DB against spam.

function hash(value: string): string {
  return createHash("sha256").update(`${HASH_SALT}:${value}`).digest("hex").slice(0, 32);
}

function readClientIp(req: Request): string | null {
  // Vercel + most CDNs forward client IP via these headers.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

// Coarse device class from the User-Agent. Honest buckets only — we don't
// infer a county (that needs geo-IP we don't run yet).
function deviceFromUA(ua: string | null): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|android(?!.*mobi)/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return "mobile";
  return "desktop";
}

export async function POST(req: Request) {
  // Body parse — be very tolerant. Anything weird → silent 204.
  let body: { name?: string; props?: Record<string, unknown>; path?: string; sessionId?: string } = {};
  try {
    const text = await req.text();
    if (text.length > MAX_PROPS_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const name = typeof body.name === "string" ? body.name.slice(0, MAX_NAME_LEN) : "";
  if (!name) return new NextResponse(null, { status: 204 });

  const rawProps = (body.props && typeof body.props === "object") ? body.props : {};
  // Server-side enrichment: stamp the device class so the client can't spoof
  // it and every event carries it for audience breakdowns.
  const props = { ...rawProps, device: deviceFromUA(req.headers.get("user-agent")) };
  const path  = typeof body.path === "string" ? body.path.slice(0, 200) : null;

  // Hash IP + session for de-dupe / distinct counts without storing PII.
  const ip          = readClientIp(req);
  const ipHash      = ip ? hash(ip) : null;
  const sessionId   = typeof body.sessionId === "string" ? body.sessionId : null;
  const sessionHash = sessionId ? hash(sessionId) : ipHash; // fall back to IP-hash

  // Resolve user_id if available — fire-and-forget; auth() failure is fine.
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch { /* ignore */ }

  if (isDbConfigured()) {
    try {
      await insertAnalyticsEvent({ name, props, path, ipHash, sessionHash, userId });
    } catch (err) {
      console.error("[analytics] insert failed:", err instanceof Error ? err.message : err);
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log("[analytics:stub]", name, JSON.stringify(props).slice(0, 200));
  }

  return new NextResponse(null, { status: 204 });
}
