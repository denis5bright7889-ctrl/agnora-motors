"use client";

import { useCookieConsent } from "./consent-context";

/**
 * Footer control for reopening the settings dialog after a decision has been
 * made. Required: a visitor who accepted must be able to withdraw as easily
 * as they agreed, and the banner is gone by then.
 *
 * A real <button>, not a link: it opens a dialog, it does not navigate.
 */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const { openSettings } = useCookieConsent();
  return (
    <button type="button" onClick={openSettings} className={className}>
      Cookie preferences
    </button>
  );
}
