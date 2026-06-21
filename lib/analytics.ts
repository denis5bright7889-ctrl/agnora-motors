// Client-side event tracker. Fire-and-forget — never blocks the UI.
// PR8 persists via /api/analytics/event into the analytics_events table.

export type AnalyticsEvent =
  // Search funnel (PR3b/PR8)
  | "search_suggestion_shown"
  | "search_suggestion_clicked"
  | "search_submitted"
  // Listing funnel (PR8)
  | "listing_viewed"
  | "contact_request_created"
  // Seller funnel — usage of the optional Technical specifications panel.
  // Fired on POST success when the seller filled at least one spec field.
  // Props: { filledFields: number, fuelType: string, bodyType: string }.
  | "listing_specifications_completed";

const SESSION_KEY = "agnora_session_id";

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch { return null; }
}

export function trackEvent(name: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    name,
    props,
    path:      window.location.pathname,
    sessionId: getSessionId(),
  });

  // sendBeacon is preferred — survives page navigation and doesn't block.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/event", blob);
      return;
    } catch { /* fall through to fetch */ }
  }
  // Best-effort fetch fallback (older browsers / sendBeacon disabled).
  fetch("/api/analytics/event", {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => { /* swallow — analytics must never break the UI */ });
}
