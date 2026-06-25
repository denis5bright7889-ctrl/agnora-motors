// Client-side event tracker. Fire-and-forget — never blocks the UI.
// PR8 persists via /api/analytics/event into the analytics_events table.

export type AnalyticsEvent =
  // Search funnel (PR3b/PR8)
  | "search_suggestion_shown"
  | "search_suggestion_clicked"
  | "search_submitted"
  // Listing funnel (PR8 + V10000 Phase 2.6)
  | "listing_viewed"
  | "contact_form_open"   // buyer opened the "Message dealer" modal
  | "phone_reveal"        // buyer tapped the dealer phone number
  | "whatsapp_click"      // reserved — no surface yet
  | "vehicle_share"       // reserved — no surface yet
  | "dealer_profile_view" // reserved — no dealer profile page yet
  | "contact_request_created"
  // Seller funnel — usage of the optional Technical specifications panel.
  // Fired on POST success when the seller filled at least one spec field.
  // Props: { filledFields: number, fuelType: string, bodyType: string }.
  | "listing_specifications_completed"
  // VIN decoder funnel — measure hit rate so we know when to add a JDM
  // provider. Fired on the seller-side, not server-side.
  //   _attempted props: { vinLength }
  //   _succeeded props: { source, matchedFields: string[] } — source is
  //     "nhtsa" | "cache" | "manual" (manual = no match).
  //   _applied   props: { appliedFields: string[] } — fields the seller
  //     actually accepted from the decoder (post-filter for empty-only).
  | "vin_decode_attempted"
  | "vin_decode_succeeded"
  | "vin_decode_applied";

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
