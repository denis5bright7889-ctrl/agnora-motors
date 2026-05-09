/**
 * GET /api/admin/stream — Server-Sent Events endpoint for admin real-time.
 *
 * Vercel constraints:
 *   • Hobby plan: 60 s function timeout
 *   • Pro plan:  300 s timeout
 *   We close the stream at 45 s so clients on any plan reconnect safely.
 *   The EventSource client reconnects immediately on close, giving
 *   continuous real-time with ~1.5 s event latency.
 *
 * Event flow:
 *   1. Connection opens → send cursor (latest event id) + initial snapshot
 *   2. Every POLL_MS: query platform_events for rows newer than cursor
 *   3. On new events: re-fetch fresh analytics snapshot and send to client
 *   4. Every 25 s: send SSE comment heartbeat (keeps proxies from timing out)
 *   5. At MAX_AGE_MS: close cleanly; client reconnects and gets fresh data
 */

import { auth } from "@/auth";
import {
  getAdminStats, getTotalRevenue,
  getListingStatusBreakdown,
  getTopDealersByActivity,
} from "@/lib/db";
import {
  pollNewEvents, getLatestEventId,
} from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic  = "force-dynamic";

const POLL_MS    = 1_500;   // check for new events every 1.5 s
const HEART_MS   = 25_000;  // SSE comment heartbeat period
const MAX_AGE_MS = 45_000;  // close before Vercel 60 s hobby limit

async function buildSnapshot() {
  const [stats, totalRevenue, statusBreakdown, topDealers] = await Promise.all([
    getAdminStats(),
    getTotalRevenue(),
    getListingStatusBreakdown(),
    getTopDealersByActivity(5),
  ]);
  return {
    timestamp: new Date().toISOString(),
    stats,
    totalRevenue,
    statusBreakdown,
    topDealers,
  };
}

export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed    = false;

  function encode(eventName: string, data: unknown): Uint8Array {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    return encoder.encode(payload);
  }
  function heartbeat(): Uint8Array {
    return encoder.encode(": heartbeat\n\n");
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Track timers so we can clear them on cancel
      const timers: ReturnType<typeof setInterval>[] = [];

      function safeEnqueue(chunk: Uint8Array) {
        if (!closed) {
          try { controller.enqueue(chunk); } catch { /* stream already closed */ }
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        timers.forEach(clearInterval);
        try { controller.close(); } catch { /* already closed */ }
      }

      // 1. Get cursor — only events AFTER this id are considered "new"
      let cursor = 0;
      try {
        cursor = await getLatestEventId();
      } catch (err) {
        console.error("[stream] getLatestEventId failed:", err);
      }

      // 2. Send initial snapshot immediately
      try {
        const snap = await buildSnapshot();
        safeEnqueue(encode("snapshot", snap));
        console.log("[stream] ADMIN BYPASS ACTIVE — initial snapshot sent to admin=%s", session.user.email);
      } catch (err) {
        console.error("[stream] initial snapshot failed:", err);
      }

      // 3. Poll for new events every POLL_MS
      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const events = await pollNewEvents(cursor);
          if (events.length > 0) {
            // Advance cursor
            cursor = events[events.length - 1].id;

            // Build fresh snapshot and send
            const snap = await buildSnapshot();
            safeEnqueue(encode("snapshot", snap));

            // Also send the raw event list so clients can show notifications
            safeEnqueue(encode("events", events));

            console.log("[stream] pushed snapshot on %d new event(s):", events.length,
              events.map((e) => e.type).join(", "));
          }
        } catch (err) {
          console.error("[stream] poll error:", err);
        }
      }, POLL_MS);
      timers.push(pollTimer);

      // 4. Heartbeat — prevents proxies/CDNs from closing idle connections
      const heartTimer = setInterval(() => safeEnqueue(heartbeat()), HEART_MS);
      timers.push(heartTimer);

      // 5. Max lifetime — close before Vercel timeout; client reconnects
      const closeTimer = setTimeout(close, MAX_AGE_MS) as unknown as ReturnType<typeof setInterval>;
      timers.push(closeTimer);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      // Disable Nginx / Vercel edge buffering so events arrive instantly
      "X-Accel-Buffering": "no",
    },
  });
}
