"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ALLOW_ALL,
  CONSENT_EVENT,
  DENY_ALL,
  readConsent,
  writeConsent,
  type ConsentRecord,
  type OptionalCategory,
} from "@/lib/consent";
import { CookieBanner } from "./cookie-banner";
import { CookieSettingsModal } from "./cookie-settings-modal";

interface ConsentApi {
  /** The stored decision, or null if the visitor has not made one. */
  consent: ConsentRecord | null;
  /** True once the client has read the cookie — nothing renders before this. */
  ready: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (choice: Record<OptionalCategory, boolean>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  settingsOpen: boolean;
}

const Ctx = createContext<ConsentApi | null>(null);

export function useCookieConsent(): ConsentApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCookieConsent must be used inside <CookieConsentProvider>");
  return ctx;
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The cookie is read AFTER mount, never during render. Reading it during
  // render would make the server and client disagree about whether the
  // banner exists, and React would discard the markup with a hydration error.
  useEffect(() => {
    setConsent(readConsent());
    setReady(true);

    // Keeps this tab honest if the decision changes elsewhere — another tab
    // (storage/cookie change is not observable directly, so we listen for our
    // own event) or the footer's "Cookie preferences" control.
    const onChange = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const commit = useCallback((choice: Record<OptionalCategory, boolean>) => {
    setConsent(writeConsent(choice));
    setSettingsOpen(false);
  }, []);

  const api = useMemo<ConsentApi>(
    () => ({
      consent,
      ready,
      settingsOpen,
      acceptAll: () => commit(ALLOW_ALL),
      rejectAll: () => commit(DENY_ALL),
      save: commit,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [consent, ready, settingsOpen, commit],
  );

  // Banner shows only when a decision has not been made. The modal can be
  // reopened at any time from the footer, decision or not.
  const showBanner = ready && consent === null;

  return (
    <Ctx.Provider value={api}>
      {children}
      {showBanner && !settingsOpen && <CookieBanner />}
      {settingsOpen && <CookieSettingsModal />}
    </Ctx.Provider>
  );
}
