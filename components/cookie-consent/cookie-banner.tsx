"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useCookieConsent } from "./consent-context";

export function CookieBanner() {
  const { acceptAll, rejectAll, openSettings } = useCookieConsent();

  return (
    <div
      // Not role="dialog": the banner does not trap focus, so the visitor can
      // keep reading and navigating. Treating it as a modal would be a lie to
      // assistive technology and would block the page until a choice is made,
      // which is itself a dark pattern.
      role="region"
      aria-label="Cookie consent"
      className={[
        "fixed inset-x-0 z-[60]",
        // Sits ABOVE the mobile bottom nav (h-14) so it never covers
        // navigation; on md+ the bottom nav is hidden, so it drops flush.
        "bottom-14 md:bottom-0",
        "border-t border-border bg-surface/95 backdrop-blur-xl",
        "shadow-[0_-8px_32px_-20px_rgb(0_0_0/0.35)]",
      ].join(" ")}
    >
      <div className="container max-w-container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <Cookie className="h-[18px] w-[18px]" />
          </span>
          <p className="text-[13px] leading-relaxed text-muted">
            We use cookies to enhance your experience, understand how our platform is used, and
            improve our services. You can manage your preferences at any time.{" "}
            <Link href="/cookies" className="font-medium text-foreground underline underline-offset-2 hover:text-accent">
              Cookie Policy
            </Link>
          </p>
        </div>

        {/* Reject is given the same size, weight and prominence as Accept.
            Only the fill differs, and nothing is pre-selected. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="h-10 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Manage
          </button>
          <button
            type="button"
            onClick={rejectAll}
            className="h-10 rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:bg-surface-2"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
