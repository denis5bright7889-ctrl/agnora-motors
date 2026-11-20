import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/cookie-consent/preferences-link";
import { CONSENT_MAX_AGE_DAYS, CONSENT_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Cookie Policy — Agnora Motors",
  description:
    "How Agnora Motors uses cookies, what each category does, and how to change your preferences.",
};

// Every factual claim on this page is checked against the code:
//   - the consent cookie's name, lifetime and contents  → lib/consent.ts
//   - what analytics actually collects                  → lib/analytics.ts
//   - that no third-party tracker exists                → audited, none found
// If any of those change, this page must change with them.

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-section-title mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function CookiePolicyPage() {
  return (
    <div className="container max-w-3xl py-12 lg:py-16">
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="text-page-title">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted">
          How Agnora Motors uses cookies and similar storage, and how you control it.
        </p>
        <p className="mt-4 text-xs text-muted">
          Consent policy version {CONSENT_VERSION}
        </p>
      </header>

      <div className="space-y-10">
        <Section id="what" title="What cookies are">
          <p>
            A cookie is a small text file a website stores in your browser. Related technologies —
            such as <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">localStorage</code> and{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">sessionStorage</code> — keep
            data in your browser in a similar way. This policy covers all of them, because what
            matters is the purpose, not the storage mechanism.
          </p>
        </Section>

        <Section id="why" title="Why Agnora uses cookies">
          <p>
            To keep you signed in, to keep the site secure, to remember preferences such as your
            theme and saved vehicles, and — with your permission — to measure how the platform is
            used so we can improve it.
          </p>
        </Section>

        <Section id="essential" title="Essential cookies">
          <p>
            These keep the platform working and cannot be switched off. They cover sign-in and
            session management, security protections such as request rate limiting, and your own
            interface choices — the light or dark theme, your saved vehicles, and the vehicles you
            recently viewed. These are stored only in your browser and are not used to build a
            profile of you.
          </p>
          <p>
            Your cookie choice itself is also stored this way. It has to be: without it we would
            have no way to remember that you declined.
          </p>
        </Section>

        <Section id="analytics" title="Analytics cookies">
          <p>
            Off unless you turn them on. When enabled, Agnora records how the platform is used —
            which searches are run, which listings are opened, and when a buyer chooses to contact a
            seller — together with a short-lived random session identifier so that a single visit
            can be understood as one journey.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              This measurement is entirely first-party.
            </strong>{" "}
            It is collected by Agnora and stored in Agnora&apos;s own database. No third-party
            analytics service — Google Analytics or otherwise — is used on this site. If that ever
            changes, the consent policy version will be raised and you will be asked again.
          </p>
          <p>
            If you decline, nothing is sent: no event is transmitted and no session identifier is
            created. Declining later also deletes the identifier already in your browser.
          </p>
        </Section>

        <Section id="marketing" title="Marketing cookies">
          <p>
            Off unless you turn them on. These would be used to measure advertising performance and
            personalise marketing.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              Agnora currently runs no advertising or marketing technology at all.
            </strong>{" "}
            The category exists so that consent is already in place before any such technology could
            be introduced — never afterwards. Enabling it today permits nothing, because there is
            nothing to permit.
          </p>
        </Section>

        <Section id="consent" title="How consent works">
          <p>
            The first time you visit, a banner asks you to choose. Nothing optional runs before you
            decide, and continuing to browse is not treated as agreement. Optional categories are
            never pre-selected, and declining takes exactly as few clicks as accepting.
          </p>
          <p>
            Your decision is stored in a first-party cookie named{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">agnora_consent</code>,
            recording which categories you allowed, when you decided, and the policy version you
            decided against. It is not shared with anyone and does not identify you.
          </p>
        </Section>

        <Section id="change" title="Changing your mind">
          <p>
            Select <CookiePreferencesLink className="font-medium text-foreground underline underline-offset-2 hover:text-accent" />{" "}
            here or in the footer of any page. Changes apply immediately — there is no need to
            reload. You can also delete the cookie through your browser&apos;s settings, which
            returns you to the undecided state and brings the banner back.
          </p>
        </Section>

        <Section id="retention" title="How long your choice is kept">
          <p>
            Your consent cookie lasts {CONSENT_MAX_AGE_DAYS} days, after which you will be asked
            again. You will also be asked again sooner if the consent policy changes materially —
            for example if a new category is introduced, or an existing one begins doing something
            it did not do before.
          </p>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[13px] text-foreground">
            <strong className="font-semibold">Requires legal review:</strong> this page describes
            how long your <em>consent choice</em> is stored, which is set in the code. It does not
            state a retention period for the analytics records themselves, nor the legal basis for
            processing, nor Agnora&apos;s registered entity details. Those need to be confirmed by
            someone qualified and are deliberately not invented here.
          </p>
        </Section>

        <Section id="contact" title="Contacting us">
          <p>
            Questions about this policy or your data can go to{" "}
            <a
              href="mailto:support@agnora-motors.com"
              className="font-medium text-foreground underline underline-offset-2 hover:text-accent"
            >
              support@agnora-motors.com
            </a>
            .
          </p>
        </Section>
      </div>

      <footer className="mt-12 border-t border-border pt-6">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← Back to Agnora Motors
        </Link>
      </footer>
    </div>
  );
}
