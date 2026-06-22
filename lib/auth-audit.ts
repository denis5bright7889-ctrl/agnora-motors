// Server-side auth audit events. Writes to the analytics_events table
// (created in PR8) using a small set of `auth_*` names. Failure to log is
// never a reason to fail the underlying auth operation — every call here is
// fire-and-forget with caught errors.
//
// Event names (intentionally a small enum):
//   auth_login_success — credentials OR google sign-in succeeded
//   auth_login_failed  — credentials sign-in returned null
//   auth_link_google   — Google account linked to an existing user
//   auth_password_set  — password set/reset via reset code
//   auth_register      — new user created (email or google)

import { isDbConfigured, insertAnalyticsEvent } from "@/lib/db";

export type AuthAuditEvent =
  | "auth_login_success"
  | "auth_login_failed"
  | "auth_link_google"
  | "auth_password_set"
  | "auth_register";

export function recordAuthEvent(
  name:  AuthAuditEvent,
  props: Record<string, unknown>,
): void {
  if (!isDbConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth-audit:stub]", name, JSON.stringify(props).slice(0, 200));
    }
    return;
  }
  insertAnalyticsEvent({
    name,
    props,
    path: "/api/auth",
  }).catch((err) => {
    console.error("[auth-audit] insert failed:", err instanceof Error ? err.message : err);
  });
}
