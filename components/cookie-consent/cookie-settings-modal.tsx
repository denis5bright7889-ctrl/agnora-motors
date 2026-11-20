"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCookieConsent } from "./consent-context";
import type { OptionalCategory } from "@/lib/consent";

const CATEGORIES: {
  key: OptionalCategory | "essential";
  title: string;
  description: string;
  examples?: string;
}[] = [
  {
    key: "essential",
    title: "Essential cookies",
    description:
      "Required for the platform to function properly, including authentication, security and session management.",
  },
  {
    key: "analytics",
    title: "Analytics cookies",
    description:
      "Help us understand how visitors interact with Agnora so we can improve the platform.",
    examples: "Currently: Agnora's own first-party usage measurement. No third-party analytics service is in use.",
  },
  {
    key: "marketing",
    title: "Marketing cookies",
    description:
      "Used to measure advertising performance and personalise marketing where applicable.",
    examples: "Currently: none. No advertising or marketing technology is in use on Agnora.",
  },
];

export function CookieSettingsModal() {
  const { consent, save, acceptAll, closeSettings } = useCookieConsent();
  const titleId = useId();
  const descId = useId();

  // Seeded from the stored decision; off for a visitor who has not decided.
  // Nothing optional is ever pre-selected.
  const [draft, setDraft] = useState<Record<OptionalCategory, boolean>>({
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Remember what had focus so it can be handed back on close.
    restoreRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    // Lock background scrolling while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSettings();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      // Focus trap: Tab from the last control wraps to the first, and
      // Shift+Tab from the first wraps to the last, so keyboard focus cannot
      // wander behind the dialog.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [closeSettings]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Clicking the backdrop closes WITHOUT saving — it is not consent. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeSettings}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-surface",
          "rounded-t-2xl sm:max-w-lg sm:rounded-2xl",
          "border border-border shadow-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-section-title">Cookie settings</h2>
            <p id={descId} className="mt-1 text-[13px] text-muted">
              Choose which cookies Agnora may use. Essential cookies keep the site working and
              cannot be turned off.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            aria-label="Close cookie settings"
            data-autofocus
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {CATEGORIES.map((cat) => {
            const essential = cat.key === "essential";
            const checked = essential ? true : draft[cat.key as OptionalCategory];
            return (
              <div key={cat.key} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      {cat.title}
                      {essential && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                          <Lock className="h-2.5 w-2.5" /> Always on
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{cat.description}</p>
                    {cat.examples && (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted/80">{cat.examples}</p>
                    )}
                  </div>

                  <CategoryToggle
                    label={cat.title}
                    checked={checked}
                    disabled={essential}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, [cat.key as OptionalCategory]: v }))
                    }
                  />
                </div>
              </div>
            );
          })}

          <p className="px-1 text-[12px] leading-relaxed text-muted">
            Your choice is stored for 180 days. You can change it at any time from{" "}
            <span className="font-medium text-foreground">Cookie preferences</span> in the footer.{" "}
            <Link href="/cookies" className="underline underline-offset-2 hover:text-accent">
              Read the Cookie Policy
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => save(draft)}
            className="h-10 rounded-full border border-border px-5 text-sm font-semibold transition-colors hover:bg-surface-2"
          >
            Save Preferences
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

/**
 * A real button with role="switch", not a styled checkbox: it is reachable by
 * Tab, toggles on Space and Enter for free, and reports its state to a screen
 * reader through aria-checked.
 */
function CategoryToggle({
  label, checked, disabled, onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}${disabled ? " (always enabled)" : ""}`}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-accent" : "bg-surface-2 border border-border",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform",
          "h-[18px] w-[18px]",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
