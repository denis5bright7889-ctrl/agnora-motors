import test from "node:test";
import assert from "node:assert/strict";

// Tests for the cookie-consent system.
//
// Two halves, and the second is the one that matters. The first checks that a
// decision is stored and read back correctly. The second checks that the
// decision actually GATES tracking — a consent banner that records clicks but
// lets the events through anyway is worse than none, because it claims a
// compliance it does not have.

// ── minimal DOM ────────────────────────────────────────────────────────────
// lib/consent.ts talks to document.cookie and window; node:test has neither.
// A tiny cookie jar with the one behaviour that matters: setting a cookie
// replaces the entry of the same name.

const jar = new Map<string, string>();
const sessionStore = new Map<string, string>();
const dispatched: string[] = [];

function installDom() {
  jar.clear();
  sessionStore.clear();
  dispatched.length = 0;

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      },
      set cookie(str: string) {
        const [pair] = str.split(";");
        const eq = pair.indexOf("=");
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      },
    },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent(e: { type: string }) { dispatched.push(e.type); return true; },
      location: { protocol: "http:", pathname: "/cars" },
    },
  });

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => { sessionStore.set(k, v); },
      removeItem: (k: string) => { sessionStore.delete(k); },
    },
  });

  // CustomEvent is not defined in bare Node's global scope.
  if (typeof (globalThis as Record<string, unknown>).CustomEvent === "undefined") {
    (globalThis as Record<string, unknown>).CustomEvent = class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }
}

installDom();

const {
  CONSENT_COOKIE, CONSENT_VERSION, ANALYTICS_SESSION_KEY,
  consentFromCookieString, hasConsent, writeConsent, readCookie,
} = await import("../lib/consent.ts");

// ── 1. reading a stored decision ───────────────────────────────────────────

test("no cookie means no decision, which is not the same as a refusal", () => {
  assert.equal(consentFromCookieString(""), null);
  assert.equal(consentFromCookieString("other=1; unrelated=2"), null);
});

test("a decision made against an older policy version is not reused", () => {
  // The whole point of versioning: if the policy changed materially, the old
  // agreement does not cover the new behaviour and must be taken again.
  const stale = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION - 1, ts: "x", analytics: true, marketing: true }));
  assert.equal(consentFromCookieString(`${CONSENT_COOKIE}=${stale}`), null);
});

test("a malformed cookie is treated as no decision, never as permission", () => {
  for (const bad of ["not-json", "%7Bbroken", encodeURIComponent("[]"), encodeURIComponent("null")]) {
    assert.equal(
      consentFromCookieString(`${CONSENT_COOKIE}=${bad}`), null,
      `${bad} must not parse into a decision`,
    );
  }
});

test("anything that is not exactly true reads as false", () => {
  // A truthy-but-not-true value (a string, a 1) must not grant permission.
  const sneaky = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, ts: "t", analytics: "yes", marketing: 1 }));
  const parsed = consentFromCookieString(`${CONSENT_COOKIE}=${sneaky}`);
  assert.ok(parsed, "the record itself is well-formed enough to parse");
  assert.equal(parsed.analytics, false);
  assert.equal(parsed.marketing, false);
});

test("readCookie picks the right entry and ignores prefixes", () => {
  const c = `not_agnora_consent=xx; ${CONSENT_COOKIE}=yy; after=zz`;
  assert.equal(readCookie(c, CONSENT_COOKIE), "yy");
  assert.equal(readCookie(c, "missing"), null);
});

// ── 2. persistence ─────────────────────────────────────────────────────────

test("a decision survives being written and read back", () => {
  installDom();
  writeConsent({ analytics: true, marketing: false });

  // Read through the real accessor, exactly as a later page load would.
  const record = consentFromCookieString(document.cookie);
  assert.ok(record, "the decision should be readable after a 'reload'");
  assert.equal(record.analytics, true);
  assert.equal(record.marketing, false);
  assert.equal(record.v, CONSENT_VERSION, "the policy version must be recorded");
  assert.ok(Date.parse(record.ts) > 0, "the decision time must be recorded");
});

test("the cookie is scoped and given an expiry", () => {
  installDom();
  let written = "";
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { get cookie() { return ""; }, set cookie(v: string) { written = v; } },
  });
  writeConsent({ analytics: false, marketing: false });

  assert.match(written, /Path=\//, "must apply site-wide");
  assert.match(written, /Max-Age=\d+/, "must expire rather than persist forever");
  assert.match(written, /SameSite=Lax/, "never needed cross-site");
  assert.ok(!/SameSite=None/.test(written), "SameSite=None would widen exposure for no benefit");
});

test("rejecting deletes the analytics identifier already in the browser", () => {
  installDom();
  sessionStore.set(ANALYTICS_SESSION_KEY, "existing-id");
  writeConsent({ analytics: false, marketing: false });
  assert.equal(
    sessionStore.get(ANALYTICS_SESSION_KEY), undefined,
    "withdrawing consent must not leave the identifier behind for reuse",
  );
});

test("essential consent cannot be withheld, optional consent must be granted", () => {
  installDom();
  assert.equal(hasConsent("essential"), true, "essential is always permitted");
  assert.equal(hasConsent("analytics"), false, "no decision means no permission");
  assert.equal(hasConsent("marketing"), false);

  writeConsent({ analytics: true, marketing: false });
  assert.equal(hasConsent("analytics"), true);
  assert.equal(hasConsent("marketing"), false, "categories are independent");
});

// ── 3. enforcement — the part that makes this real ─────────────────────────

const beacons: string[] = [];
const fetches: string[] = [];

function installNetwork() {
  beacons.length = 0;
  fetches.length = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { sendBeacon: (url: string) => { beacons.push(url); return true; } },
  });
  (globalThis as Record<string, unknown>).Blob = class { constructor(_parts: unknown[]) {} };
  (globalThis as Record<string, unknown>).fetch = (url: string) => {
    fetches.push(url);
    return Promise.resolve({ ok: true });
  };
}

const { trackEvent } = await import("../lib/analytics.ts");

test("no event is transmitted before a decision is made", () => {
  installDom();
  installNetwork();

  trackEvent("listing_viewed", { id: "abc" });
  trackEvent("search_submitted", { q: "subaru" });

  assert.deepEqual(beacons, [], "an event was sent before consent was given");
  assert.deepEqual(fetches, [], "an event was sent before consent was given");
});

test("no session identifier is minted before consent either", () => {
  installDom();
  installNetwork();

  trackEvent("listing_viewed", {});

  assert.equal(
    sessionStore.get(ANALYTICS_SESSION_KEY), undefined,
    "the tracking identifier must not be created for a visitor who has not agreed",
  );
});

test("rejecting analytics keeps events suppressed", () => {
  installDom();
  installNetwork();
  writeConsent({ analytics: false, marketing: false });

  trackEvent("phone_reveal", {});

  assert.deepEqual(beacons, [], "Reject All must actually stop the tracking");
  assert.deepEqual(fetches, []);
});

test("granting analytics lets events through", () => {
  // The guard must not be so enthusiastic that it breaks the feature it
  // protects: with permission, tracking has to work.
  installDom();
  installNetwork();
  writeConsent({ analytics: true, marketing: false });

  trackEvent("contact_form_open", { carId: "1" });

  assert.equal(beacons.length, 1, "a permitted event should be sent");
  assert.match(beacons[0], /\/api\/analytics\/event$/);
});

test("withdrawing consent stops events that were previously flowing", () => {
  installDom();
  installNetwork();

  writeConsent({ analytics: true, marketing: false });
  trackEvent("listing_viewed", {});
  assert.equal(beacons.length, 1, "allowed while permitted");

  writeConsent({ analytics: false, marketing: false });
  trackEvent("listing_viewed", {});
  assert.equal(beacons.length, 1, "a changed preference must apply immediately, not on reload");
});

test("marketing consent alone does not open the analytics channel", () => {
  installDom();
  installNetwork();
  writeConsent({ analytics: false, marketing: true });

  trackEvent("search_submitted", {});
  assert.deepEqual(beacons, [], "the categories must be enforced independently");
});

// ── 4. the gate is where it cannot be bypassed ─────────────────────────────

test("the consent check sits inside trackEvent, not at its call sites", async () => {
  // If the check lived in the components that fire events, a new call site
  // would silently be untracked by consent. Asserted against the source
  // because that is a property of the design, not of any single call.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("lib/analytics.ts", "utf8");
  const fn = src.slice(src.indexOf("export function trackEvent"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.match(body, /hasConsent\("analytics"\)/, "trackEvent must consult consent itself");
  assert.ok(
    body.indexOf("hasConsent") < body.indexOf("sendBeacon"),
    "the check must come before anything is transmitted",
  );
});
