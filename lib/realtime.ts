/**
 * lib/realtime.ts
 *
 * Thin DB-backed event bus for real-time admin dashboard updates.
 *
 * Architecture:
 *   Producer  → publishEvent()        → INSERT INTO platform_events
 *   Consumer  → pollNewEvents(sinceId) → SELECT WHERE id > sinceId
 *   SSE route → polls every 1.5 s, sends snapshot to client on change
 *
 * No external pub/sub (Pusher/Redis/Ably) needed. Works on Vercel
 * serverless because state lives in Postgres, not in-process memory.
 */

import { query } from "@/lib/db";

export type EventType =
  | "user_registered"
  | "listing_created"
  | "listing_sold"
  | "lead_created"
  | "dealer_approved"
  | "dealer_rejected"
  | "seller_approved";

export interface PlatformEvent {
  id: number;
  type: EventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Write an event to the platform_events table.
 * Called from API routes whenever something significant happens.
 * Fails silently — never crashes the caller.
 */
export async function publishEvent(
  type: EventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO platform_events (type, payload) VALUES ($1, $2)`,
      [type, JSON.stringify(payload)],
    );
  } catch (err) {
    // Non-fatal: real-time is a nice-to-have, not critical path
    console.error("[realtime] publishEvent failed:", (err as Error).message);
  }
}

/**
 * Return all events with id > sinceId, ordered ascending.
 * Used by the SSE endpoint to detect changes since last poll.
 */
export async function pollNewEvents(sinceId: number): Promise<PlatformEvent[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, type, payload, created_at AS "createdAt"
     FROM platform_events
     WHERE id > $1
     ORDER BY id ASC
     LIMIT 50`,
    [sinceId],
  );
  return rows.map((r) => ({
    id:        r.id as number,
    type:      r.type as EventType,
    payload:   (r.payload as Record<string, unknown>) ?? {},
    createdAt: r.createdAt as string,
  }));
}

/**
 * Get the id of the most recent event (used as the starting cursor
 * when a new SSE connection opens so we only see future events).
 */
export async function getLatestEventId(): Promise<number> {
  const rows = await query<{ id: number }>(
    `SELECT COALESCE(MAX(id), 0)::INT AS id FROM platform_events`,
  );
  return rows[0]?.id ?? 0;
}
