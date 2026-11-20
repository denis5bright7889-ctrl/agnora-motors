// Cookie-consent state.
//
// Deliberately free of React so that lib/analytics.ts can consult it
// synchronously, from any call site, without a hook or a provider in scope.
// That matters: the gate has to sit in the one place every event passes
// through, not in the components that happen to render a banner.
//
// Storage is a first-party cookie rather than localStorage, because:
//   - it is the conventional mechanism and survives across subdomains;
//   - it is readable on the server if a future feature needs to decide
//     before hydration;
//   - it has an explicit expiry, which localStorage does not.

export const CONSENT_COOKIE = "agnora_consent";

/**
 * Bump ONLY when a change materially alters what the user agreed to — a new
 * category, or an existing category starting to do something it did not do
 * before. A stored record with a lower version is treated as no decision at
 * all, so the banner reappears and consent is taken afresh.
 */
export const CONSENT_VERSION = 1;

/** How long a decision stands before we ask again. */
export const CONSENT_MAX_AGE_DAYS = 180;

/** Fired on the window whenever the decision changes, in any tab. */
export const CONSENT_EVENT = "agnora:consent-change";

export type OptionalCategory = "analytics" | "marketing";
export type ConsentCategory = "essential" | OptionalCategory;

export interface ConsentRecord {
  /** Policy version this decision was made against. */
  v: number;
  /** ISO timestamp of the decision. */
  ts: string;
  analytics: boolean;
  marketing: boolean;
}

/** Nothing optional is on by default. There is no pre-ticked box here. */
export const DENY_ALL: Omit<ConsentRecord, "v" | "ts"> = {
  analytics: false,
  marketing: false,
};

export const ALLOW_ALL: Omit<ConsentRecord, "v" | "ts"> = {
  analytics: true,
  marketing: true,
};

function parse(raw: string): ConsentRecord | null {
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentRecord>;
    if (typeof data !== "object" || data === null) return null;
    if (data.v !== CONSENT_VERSION) return null; // stale policy → ask again
    if (typeof data.ts !== "string") return null;
    return {
      v: CONSENT_VERSION,
      ts: data.ts,
      // Anything not explicitly true is false. A malformed or partial record
      // must never be read as permission.
      analytics: data.analytics === true,
      marketing: data.marketing === true,
    };
  } catch {
    return null;
  }
}

/** Reads a raw cookie value by name from a cookie string. Exported for tests. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Parses a cookie string into a decision. Exported so it can be tested and
 *  reused on the server without touching `document`. */
export function consentFromCookieString(cookieString: string): ConsentRecord | null {
  const raw = readCookie(cookieString, CONSENT_COOKIE);
  return raw ? parse(raw) : null;
}

/**
 * The visitor's decision, or null if they have not made a valid one.
 * Returns null during SSR: the banner is client-rendered after hydration so
 * the markup cannot disagree between server and client.
 */
export function readConsent(): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  return consentFromCookieString(document.cookie);
}

/** True only when the visitor has actively permitted that category. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "essential") return true; // cannot be withheld
  const record = readConsent();
  if (!record) return false;                 // no decision ⇒ no permission
  return record[category] === true;
}

export function serializeConsent(record: ConsentRecord): string {
  return encodeURIComponent(JSON.stringify(record));
}

/** Persists a decision and notifies listeners in this tab. */
export function writeConsent(choice: Omit<ConsentRecord, "v" | "ts">): ConsentRecord {
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    ts: new Date().toISOString(),
    analytics: choice.analytics === true,
    marketing: choice.marketing === true,
  };

  if (typeof document !== "undefined") {
    const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    // Lax, not None: this cookie is never needed on a cross-site request, and
    // SameSite=None would require Secure and widen exposure for no benefit.
    document.cookie =
      `${CONSENT_COOKIE}=${serializeConsent(record)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;

    // Revoking analytics should also drop the identifier it created, rather
    // than leaving it to be reused if consent is granted again later.
    if (!record.analytics) clearAnalyticsStorage();

    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  }

  return record;
}

/** The sessionStorage key lib/analytics.ts uses to correlate events. */
export const ANALYTICS_SESSION_KEY = "agnora_session_id";

export function clearAnalyticsStorage(): void {
  try {
    sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
  } catch {
    /* private mode / blocked storage — nothing to clear */
  }
}
