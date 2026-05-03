import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Tag,
  MessageCircle,
  Globe,
  Sparkles,
  Check,
} from "lucide-react";
import { HeroSearch } from "@/components/sections/hero-search";
import { CarCard } from "@/components/car-card";
import { brands, articles, trendingArticles } from "@/data/content";
import { getAllCars } from "@/data/cars";
import { formatPrice, formatDate } from "@/lib/utils";

export default function HomePage() {
  const allCars = getAllCars();
  const featured = allCars.slice(0, 6);
  const trackedCar = allCars[5] ?? allCars[0];

  const popularNew = allCars.filter((c) => c.condition === "new").slice(0, 6);
  const popularUsed = allCars.filter((c) => c.condition === "used").slice(0, 6);
  const bodyStyles = ["SUV", "Sedan", "Hatchback", "Pickup", "Wagon", "Coupe"];

  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative grain bg-background pt-16 pb-20 lg:pt-24 lg:pb-32">
        <div className="container max-w-container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Kenya · Verified marketplace · Est. 2026
            </p>
            <h1
              className="font-display leading-[1.05] tracking-tight"
              style={{ fontSize: "clamp(36px, 8vw, 96px)" }}
            >
              Find the{" "}
              <em className="not-italic text-accent italic">one</em> that drives
              you.
            </h1>
            <p className="max-w-md text-lg text-muted leading-relaxed">
              Thousands of verified listings from vetted dealers across Kenya.
              Real prices. Real cars.
            </p>
            <div className="flex flex-wrap gap-4">
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
          </div>
          <div>
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ── Brand ticker ── */}
      <div className="border-y border-border overflow-hidden py-5 bg-surface">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...brands, ...brands].map((b, i) => (
            <span
              key={i}
              className="font-display italic text-3xl text-muted/40 px-8 shrink-0"
            >
              {b.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Featured cars ── */}
      <section className="py-20 lg:py-28">
        <div className="container max-w-container">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                Fresh listings
              </p>
              <h2 className="font-display text-4xl font-medium tracking-tight">
                Featured cars
              </h2>
            </div>
            <Link
              href="/cars"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {featured.length > 0 ? (
            <>
              {/* Mobile: horizontal snap-scroll row */}
              <div className="snap-row -mx-4 px-4 sm:hidden">
                {featured.map((car, i) => (
                  <div key={car.id} className="w-[72vw] min-w-[260px] max-w-[320px]">
                    <CarCard car={car} priority={i < 2} />
                  </div>
                ))}
                {/* End cap so the last card doesn't hug the edge */}
                <div className="w-4 shrink-0" aria-hidden />
              </div>
              {/* sm+: normal grid */}
              <div className="hidden sm:grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((car, i) => (
                  <CarCard key={car.id} car={car} priority={i < 3} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No listings yet.</p>
          )}

          <div className="mt-8 sm:hidden">
            <Link
              href="/cars"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Browse all listings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Popular brands ── */}
      <section id="brands" className="py-20 lg:py-28 bg-surface">
        <div className="container max-w-container">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            Shop by make
          </p>
          <h2 className="mb-10 font-display text-4xl font-medium tracking-tight">
            Popular brands
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {brands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/cars?make=${brand.slug}`}
                className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background p-4 hover:border-accent hover:bg-accent-soft transition-all"
              >
                <span className="font-display text-4xl text-muted/30 group-hover:text-accent transition-colors">
                  {brand.name[0]}
                </span>
                <span className="text-center text-xs font-semibold">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Garage tracking ── */}
      {trackedCar && (
        <section className="py-20 lg:py-28">
          <div className="container max-w-container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Know your car's worth
              </p>
              <h2 className="font-display text-4xl font-medium leading-tight tracking-tight">
                Track market value in real time
              </h2>
              <ul className="space-y-3 text-sm text-muted">
                {[
                  "Live pricing from thousands of active listings",
                  "Alerts when similar cars sell near you",
                  "Dealer offer comparisons in one place",
                  "Monthly market report for your exact trim",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
                >
                  Start tracking free
                </Link>
                <Link
                  href="/cars"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-6 text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  See market prices
                </Link>
              </div>
            </div>

            <div className="relative pb-4">
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-black/5 dark:shadow-black/30">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 mb-5">
                  <Image
                    src={trackedCar.images[0]}
                    alt={`${trackedCar.year} ${trackedCar.make} ${trackedCar.model}`}
                    fill
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-sm">
                      {trackedCar.year} {trackedCar.make} {trackedCar.model}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {trackedCar.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted mb-0.5">Current value</p>
                    <p className="font-display text-xl font-semibold text-accent">
                      KSh {formatPrice(trackedCar.price)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-1.5 text-green-500 font-medium">
                    <TrendingUp className="h-4 w-4" /> +5.6% / 30d
                  </span>
                  <span className="text-xs text-muted">Updated 2h ago</span>
                </div>
                <div className="absolute -bottom-3 right-6 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                  Offers spiked: 3 dealers bidding
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Sell paths ── */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="container max-w-container">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            Ready to sell?
          </p>
          <h2 className="mb-10 font-display text-4xl font-medium tracking-tight">
            Your way, your terms
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background p-8 hover-lift">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Option 01
              </p>
              <h3 className="font-display text-2xl font-medium mb-3">
                Get an instant cash offer
              </h3>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Multiple dealers compete for your car. Get real offers within 24
                hours with no obligation.
              </p>
              <div className="mb-6 flex -space-x-2">
                {["D", "M", "S", "K", "P"].map((l, i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-surface-2 text-xs font-semibold"
                  >
                    {l}
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-accent-soft text-xs font-semibold text-accent">
                  +14
                </div>
              </div>
              <Link
                href="/sell"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
              >
                Get my offer <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-border bg-background p-8 hover-lift">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Option 02
              </p>
              <h3 className="font-display text-2xl font-medium mb-3">
                List it yourself
              </h3>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Set your price. Control your sale. Reach thousands of verified
                buyers across Kenya. No hidden fees.
              </p>
              <div className="mb-6 flex items-center gap-2 text-sm text-muted">
                <Sparkles className="h-4 w-4 text-accent" />
                Free for the first 30 days
              </div>
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

      {/* ── News & reviews ── */}
      <section className="py-20 lg:py-28">
        <div className="container max-w-container">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                From the editors
              </p>
              <h2 className="font-display text-4xl font-medium tracking-tight">
                News & reviews
              </h2>
            </div>
            <Link
              href="/research"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              All articles <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
              {articles.slice(0, 4).map((article) => (
                <Link
                  key={article.slug}
                  href={`/research/${article.slug}`}
                  className="group hover-lift block"
                >
                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-2 mb-4">
                    <Image
                      src={article.cover}
                      alt={article.title}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-900 backdrop-blur">
                      {article.category}
                    </span>
                  </div>
                  <p className="font-medium leading-snug group-hover:text-accent transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    {article.author} · {article.readTime} min read
                  </p>
                </Link>
              ))}
            </div>

            <div>
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted">
                Trending near you
              </h3>
              <ol className="space-y-4">
                {trendingArticles.map((title, i) => (
                  <li
                    key={title}
                    className="flex gap-4 text-sm leading-snug group"
                  >
                    <span className="font-display text-2xl text-muted/30 tabular-nums shrink-0 leading-none">
                      0{i + 1}
                    </span>
                    <span className="group-hover:text-accent transition-colors cursor-pointer">
                      {title}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="container max-w-container">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            Why Agnora
          </p>
          <h2 className="mb-12 font-display text-4xl font-medium tracking-tight">
            Built for{" "}
            <span className="font-normal text-muted">Kenyan</span> car buyers
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "Verified dealers",
                desc: "Every dealer goes through KYC and listing audits before going live.",
              },
              {
                icon: Tag,
                title: "Fair market pricing",
                desc: "Prices benchmarked against thousands of real transactions across Kenya.",
              },
              {
                icon: MessageCircle,
                title: "Free to browse & contact",
                desc: "No registration required to search. Messaging a dealer is always free.",
              },
              {
                icon: Globe,
                title: "Nationwide coverage",
                desc: "Listings from Nairobi, Mombasa, Kisumu, Nakuru, and beyond.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-3xl border border-border bg-background p-7">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular searches ── */}
      <section className="py-16 lg:py-20">
        <div className="container max-w-container">
          <div className="grid gap-8 sm:grid-cols-3 text-sm">
            <div>
              <h3 className="mb-4 font-semibold text-xs uppercase tracking-widest text-muted">
                Popular new cars
              </h3>
              <ul className="space-y-2">
                {allCars
                  .filter((c) => c.condition === "new")
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/cars?condition=new&make=${c.make}`}
                        className="text-muted hover:text-foreground transition-colors"
                      >
                        New {c.make} {c.model} for sale
                      </Link>
                    </li>
                  ))}
                {popularNew.length === 0 && (
                  <li>
                    <Link
                      href="/cars?condition=new"
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      New cars in Kenya
                    </Link>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-xs uppercase tracking-widest text-muted">
                Popular used cars
              </h3>
              <ul className="space-y-2">
                {allCars
                  .filter((c) => c.condition === "used")
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/cars?condition=used&make=${c.make}`}
                        className="text-muted hover:text-foreground transition-colors"
                      >
                        Used {c.make} {c.model} for sale
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-xs uppercase tracking-widest text-muted">
                Browse by body style
              </h3>
              <ul className="space-y-2">
                {bodyStyles.map((style) => (
                  <li key={style}>
                    <Link
                      href={`/cars?body=${style.toLowerCase()}`}
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      {style}s for sale in Kenya
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
