import Link from "next/link";
import {
  Car, CarFront, CarTaxiFront, Truck, Caravan, Zap,
  ArrowRight, Banknote, Shield, Tag,
  MessageCircle, Globe, BookOpen, PlusCircle,
  Check, TrendingUp,
} from "lucide-react";
import { HeroSearch } from "@/components/sections/hero-search";
import { BrandLogo } from "@/components/brand-logo";
import { brands } from "@/data/content";

// ── Body-style categories ─────────────────────────────────────
const CATEGORIES = [
  { label: "SUV",       slug: "suv",       icon: CarFront },
  { label: "Sedan",     slug: "sedan",     icon: Car },
  { label: "Electric",  slug: "electric",  icon: Zap },
  { label: "Hatchback", slug: "hatchback", icon: CarTaxiFront },
  { label: "Pickup",    slug: "pickup",    icon: Truck },
  { label: "Wagon",     slug: "wagon",     icon: Caravan },
];

// ── Quick-action cards (2 × 2 on mobile, 4-in-a-row on desktop) ──
const QUICK_ACTIONS = [
  {
    label:    "Buy a car",
    sub:      "Browse verified listings",
    href:     "/cars",
    icon:     Car,
    accent:   "bg-accent text-white",
  },
  {
    label:    "Sell my car",
    sub:      "Get offers in 24 hrs",
    href:     "/sell",
    icon:     PlusCircle,
    accent:   "bg-foreground text-background",
  },
  {
    label:    "Finance",
    sub:      "Calculate payments",
    href:     "/finance",
    icon:     Banknote,
    accent:   "bg-blue-600 text-white",
  },
  {
    label:    "Research",
    sub:      "Reviews & news",
    href:     "/research",
    icon:     BookOpen,
    accent:   "bg-emerald-600 text-white",
  },
];

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">

      {/* ══ Hero ══════════════════════════════════════════════ */}
      <section className="relative grain bg-background pt-12 pb-16 lg:pt-20 lg:pb-28">
        <div className="container max-w-container grid gap-10 lg:grid-cols-2 lg:items-center">

          {/* Copy */}
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Kenya · Verified marketplace · Est. 2026
            </p>
            <h1
              className="font-display leading-[1.05] tracking-tight"
              style={{ fontSize: "clamp(32px, 7vw, 88px)" }}
            >
              Find the{" "}
              <em className="not-italic text-accent italic">one</em>{" "}
              that drives you.
            </h1>
            <p className="max-w-md text-base text-muted leading-relaxed">
              Thousands of verified listings from vetted dealers across Kenya.
              Real prices. Real cars.
            </p>

            {/* Mobile CTA strip — only visible < lg */}
            <div className="flex gap-3 lg:hidden">
              <Link
                href="/cars"
                className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Browse cars <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sell"
                className="flex-1 inline-flex h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Sell
              </Link>
            </div>

            {/* Desktop CTA row */}
            <div className="hidden lg:flex flex-wrap gap-4">
              <Link
                href="/cars"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Browse all cars <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sell"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-7 text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Sell your car
              </Link>
            </div>

            {/* Trust stats */}
            <div className="flex gap-6 text-sm">
              {[
                { n: "12,000+", l: "Listings" },
                { n: "350+",    l: "Dealers" },
                { n: "47",      l: "Counties" },
              ].map(({ n, l }) => (
                <div key={l}>
                  <p className="font-display text-xl font-semibold">{n}</p>
                  <p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search widget */}
          <div>
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ══ Quick actions ═════════════════════════════════════ */}
      <section className="py-10 lg:py-14">
        <div className="container max-w-container">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_ACTIONS.map(({ label, sub, href, icon: Icon, accent }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-3 rounded-3xl p-5 border border-border bg-surface hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 transition-all"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${accent} transition-transform group-active:scale-95`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-sm leading-snug">{label}</p>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{sub}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 -mt-1 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Brand ticker ══════════════════════════════════════ */}
      <div className="border-y border-border overflow-hidden py-4 bg-surface">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...brands, ...brands].map((b, i) => (
            <span
              key={i}
              className="font-display italic text-2xl text-muted/40 px-7 shrink-0"
            >
              {b.name}
            </span>
          ))}
        </div>
      </div>

      {/* ══ Vehicle categories ════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="container max-w-container">
          <div className="mb-8">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Browse by type
            </p>
            <div className="flex items-end justify-between">
              <h2 className="font-display text-3xl lg:text-4xl font-medium tracking-tight">
                What are you looking for?
              </h2>
              <Link
                href="/cars"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                All cars <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CATEGORIES.map(({ label, slug, icon: Icon }) => (
              <Link
                key={slug}
                href={`/cars?body=${slug}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-background p-4 sm:p-5 hover:border-accent hover:bg-accent-soft transition-all active:scale-95"
              >
                <span
                  className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-surface-2 text-muted group-hover:bg-accent group-hover:text-white transition-colors"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                </span>
                <span className="text-xs sm:text-sm font-semibold text-center leading-tight group-hover:text-accent transition-colors">
                  {label}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 sm:hidden text-center">
            <Link
              href="/cars"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              See all cars <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ Popular brands ════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-surface">
        <div className="container max-w-container">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
            Shop by make
          </p>
          <h2 className="mb-8 font-display text-3xl lg:text-4xl font-medium tracking-tight">
            Popular brands
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {brands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/cars?make=${brand.slug}`}
                aria-label={`Browse ${brand.name} cars`}
                className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background p-4 hover:border-accent hover:bg-accent-soft transition-all active:scale-95"
              >
                <BrandLogo brand={brand} />
                <span className="text-center text-xs font-semibold">{brand.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Sell paths ════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="container max-w-container">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
            Ready to sell?
          </p>
          <h2 className="mb-8 font-display text-3xl lg:text-4xl font-medium tracking-tight">
            Your way, your terms
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background p-7 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Option 01</p>
              <h3 className="font-display text-xl font-medium mb-2">Get an instant cash offer</h3>
              <p className="text-sm text-muted mb-5 leading-relaxed">
                Multiple dealers compete for your car. Real offers within 24 hours.
              </p>
              <Link
                href="/sell"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
              >
                Get my offer <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-3xl border border-border bg-background p-7 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Option 02</p>
              <h3 className="font-display text-xl font-medium mb-2">List it yourself</h3>
              <p className="text-sm text-muted mb-5 leading-relaxed">
                Set your price. Reach thousands of verified buyers. Free for 30 days.
              </p>
              <Link
                href="/sell"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Start listing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Finance CTA band ══════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-surface">
        <div className="container max-w-container">
          <div className="rounded-3xl bg-accent px-8 py-10 lg:px-14 lg:py-16 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5" /> Finance available
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-medium leading-tight">
                Drive away today,<br />pay over time.
              </h2>
              <p className="text-white/80 text-sm leading-relaxed max-w-md">
                Flexible hire-purchase and bank financing options on thousands of listed cars.
                Calculate your monthly payments instantly.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/finance"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white text-accent px-7 text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Calculate payments <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/cars?financing=1"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 px-7 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Browse finance cars
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Why Agnora ════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="container max-w-container">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
            Why Agnora
          </p>
          <h2 className="mb-10 font-display text-3xl lg:text-4xl font-medium tracking-tight">
            Built for{" "}
            <span className="font-normal text-muted">Kenyan</span> car buyers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "Verified dealers",
                desc: "Every dealer goes through KYC and listing audits before going live.",
              },
              {
                icon: Tag,
                title: "Fair market pricing",
                desc: "Prices benchmarked against thousands of real transactions.",
              },
              {
                icon: MessageCircle,
                title: "Free to browse & contact",
                desc: "No registration needed. Messaging a dealer is always free.",
              },
              {
                icon: Globe,
                title: "Nationwide coverage",
                desc: "Listings from Nairobi, Mombasa, Kisumu, Nakuru, and beyond.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-3xl border border-border bg-surface p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-1.5 font-semibold text-sm">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Final CTA ════════════════════════════════════════ */}
      <section className="py-14 lg:py-20 bg-surface border-t border-border">
        <div className="container max-w-container text-center space-y-6">
          <h2 className="font-display text-3xl lg:text-4xl font-medium tracking-tight">
            Ready to find your car?
          </h2>
          <p className="text-muted max-w-md mx-auto">
            Join thousands of Kenyans buying and selling cars on Agnora every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cars"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-8 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Browse all cars <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-8 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              Create free account
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-muted">
            {[
              "No registration to browse",
              "Free to contact dealers",
              "12,000+ verified listings",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-accent" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
