"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveStats {
  totalCars: number;
  totalDealers: number;
  totalUsers: number;
  pendingDealers: number;
  totalSearches: number;
  totalContacts: number;
}

export interface LiveSnapshot {
  timestamp: string;
  stats: LiveStats;
  totalRevenue: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  topDealers: Array<{
    dealerId: string;
    businessName: string;
    location: string;
    totalListings: number;
    activeListings: number;
    soldListings: number;
    revenue: number;
  }>;
}

export interface RealtimeEvent {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type ConnState = "connecting" | "live" | "reconnecting" | "error";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useLiveAnalytics
 *
 * Subscribes to /api/admin/stream (SSE) for real-time analytics updates.
 * The server closes the connection every 45 s (Vercel budget); this hook
 * reconnects instantly with no visible gap for the user.
 *
 * @param initial - Server-rendered initial snapshot passed as prop so the
 *                  page does not flash empty KPIs while the first SSE
 *                  snapshot arrives.
 */
export function useLiveAnalytics(initial?: LiveSnapshot | null) {
  const [snapshot, setSnapshot]     = useState<LiveSnapshot | null>(initial ?? null);
  const [connState, setConnState]   = useState<ConnState>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);

  const esRef       = useRef<EventSource | null>(null);
  const retryTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount  = useRef(0);
  const mounted     = useRef(true);

  const connect = useCallback(() => {
    if (!mounted.current) return;

    // Close any existing connection before opening a new one
    esRef.current?.close();
    setConnState(retryCount.current > 0 ? "reconnecting" : "connecting");

    const es = new EventSource("/api/admin/stream");
    esRef.current = es;

    es.onopen = () => {
      if (!mounted.current) return;
      setConnState("live");
      retryCount.current = 0;
      console.log("[stream] MIDDLEWARE PASSED — SSE connection established");
    };

    // Fresh analytics snapshot from server
    es.addEventListener("snapshot", (e: MessageEvent<string>) => {
      if (!mounted.current) return;
      try {
        const data = JSON.parse(e.data) as LiveSnapshot;
        setSnapshot(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("[stream] failed to parse snapshot:", err);
      }
    });

    // Raw event list (for notification feed)
    es.addEventListener("events", (e: MessageEvent<string>) => {
      if (!mounted.current) return;
      try {
        const events = JSON.parse(e.data) as RealtimeEvent[];
        setRecentEvents((prev) => [...events, ...prev].slice(0, 20));
        events.forEach((ev) => {
          console.log(`[stream] ROUTE ACCESS GRANTED: ${ev.type}`, ev.payload);
        });
      } catch {}
    });

    es.onerror = () => {
      if (!mounted.current) return;
      es.close();
      esRef.current = null;

      // Server closes connection at 45 s — this is expected, reconnect fast
      if (retryCount.current === 0) {
        // First close after a successful connection is expected (45 s limit)
        setConnState("connecting");
        retryTimer.current = setTimeout(connect, 200);
      } else {
        // Actual error — exponential back-off capped at 30 s
        setConnState("reconnecting");
        const delay = Math.min(500 * 2 ** retryCount.current, 30_000);
        retryTimer.current = setTimeout(connect, delay);
        console.warn(`[stream] reconnect attempt ${retryCount.current} in ${delay}ms`);
      }
      retryCount.current++;
    };
  }, []); // stable — no deps needed

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      esRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [connect]);

  return { snapshot, connState, lastUpdated, recentEvents };
}
