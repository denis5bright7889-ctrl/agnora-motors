"use client";

import Link from "next/link";
import { Heart, Shield, Gauge, Fuel, MapPin, Settings2, Banknote, Star, Award } from "lucide-react";
import type { Car } from "@/types";
import { formatPrice, formatMileage, cn } from "@/lib/utils";
import { useWishlist, trackRecentlyViewed } from "@/lib/store";

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  used: "Used",
  certified: "Certified",
  foreign_used: "Foreign Used",
  locally_used: "Locally Used",
};

interface Props {
  car: Car;
  priority?: boolean;
  className?: string;
}

export function CarCard({ car, priority, className }: Props) {
  const { has, toggle } = useWishlist();
  const saved = has(car.id);

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(car.id);
  }

  function handleCardClick() {
    trackRecentlyViewed(car.id);
  }

  return (
    <article
      className={cn(
        // A contained card rather than loose elements on the page background:
        // it gives every listing the same silhouette regardless of how long
        // the title runs or whether the trust row renders.
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-border bg-surface",
        "transition-[box-shadow,transform,border-color] duration-200",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_32px_-18px_rgb(0_0_0/0.25)]",
        className,
      )}
    >
      <Link href={`/cars/${car.slug}`} className="block focus-visible:outline-none" onClick={handleCardClick}>
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
          {/* Plain <img>: same defensive choice as the form / gallery so a
              missing remotePatterns entry can't break listing cards.
              `priority` becomes fetchpriority="high" for the LCP card. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={car.images[0] ?? "/placeholder-car.jpg"}
            alt={`${car.year} ${car.make} ${car.model}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />

          {/* Badges stack on the LEFT. The condition badge used to sit at
              right-3 top-3 — exactly where the wishlist button sits — so the
              heart covered it as soon as the card was hovered. */}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            {car.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-neutral-900 shadow-sm backdrop-blur">
                <Shield className="h-3 w-3" /> Verified
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-neutral-900/80 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              {CONDITION_LABELS[car.condition] ?? car.condition}
            </span>
          </div>

          {(car.financingAvailable || car.hirePurchaseAvailable) && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2 py-[3px] text-[10px] font-semibold text-white shadow-sm backdrop-blur">
              <Banknote className="h-3 w-3" />
              {car.hirePurchaseAvailable ? "Hire Purchase" : "Finance"}
            </span>
          )}
        </div>
      </Link>

      {/* Wishlist — always visible on touch, fades in on hover for pointer devices */}
      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save car"}
        onClick={handleWishlist}
        className={cn(
          "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-all active:scale-90",
          saved
            ? "bg-accent text-white shadow-lg shadow-accent/30"
            : "bg-white/90 text-neutral-900 shadow-sm md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>

      {/* flex-1 + mt-auto on the trust row keeps the bottom edge aligned
          across a row of cards whose titles wrap to different heights. */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="text-card-title">
          <Link
            href={`/cars/${car.slug}`}
            className="line-clamp-1 transition-colors hover:text-accent"
            onClick={handleCardClick}
          >
            {car.year} {car.make} {car.model}
          </Link>
        </h3>

        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="text-xs font-semibold text-muted">KSh</span>
          {/* Accent, not near-black as in the reference: the coral price is
              one of Agnora's few distinctive marks and the brief asks for the
              brand to survive the refinement. */}
          <span className="text-price text-accent">{formatPrice(car.price)}</span>
          {car.priceTier && <PriceTierChip tier={car.priceTier} marketAvg={car.marketAvg} />}
        </div>

        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-muted">
          <li className="inline-flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 shrink-0" /> {formatMileage(car.mileage)}
          </li>
          <li aria-hidden className="h-3 w-px bg-border" />
          <li className="inline-flex items-center gap-1.5 capitalize">
            <Fuel className="h-3.5 w-3.5 shrink-0" /> {car.fuel}
          </li>
          <li aria-hidden className="h-3 w-px bg-border" />
          <li className="inline-flex items-center gap-1.5 capitalize">
            <Settings2 className="h-3.5 w-3.5 shrink-0" /> {car.transmission}
          </li>
          <li className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{car.location}</span>
          </li>
        </ul>

        <DealerTrustRow dealer={car.dealer} />
      </div>
    </article>
  );
}

// Trust signals inherited from the selling dealer — shown on every card so
// buyers can weigh reliability before clicking in. Dealer-owned listings only.
function DealerTrustRow({ dealer }: { dealer: Car["dealer"] }) {
  const score = dealer.score ?? null;
  const reviews = dealer.reviews ?? 0;
  const showAny = dealer.slug && (dealer.verified || reviews > 0 || score != null);
  if (!showAny) return null;

  return (
    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
      {dealer.verified && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
          <Shield className="h-3 w-3" /> Verified
        </span>
      )}
      {reviews > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {dealer.rating.toFixed(1)} ({reviews})
        </span>
      )}
      {score != null && score >= 80 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          <Award className="h-2.5 w-2.5" /> Trusted · {score}
        </span>
      )}
      {score != null && score < 80 && (
        <span className="text-[11px] text-muted">Score {score}</span>
      )}
    </div>
  );
}

// PR6: price-tier chip. "Based on similar listed prices" is the v1 disclosure —
// once real sold-price history is in place (PR8+), the source flips to actual
// transactions without changing this component.
function PriceTierChip({
  tier, marketAvg,
}: { tier: "great" | "fair" | "above"; marketAvg?: number }) {
  const config = {
    great: { label: "Great deal",   cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
    fair:  { label: "Fair price",   cls: "bg-blue-500/15    text-blue-600    dark:text-blue-400    border-blue-500/25" },
    above: { label: "Above market", cls: "bg-amber-500/15   text-amber-700   dark:text-amber-400   border-amber-500/25" },
  }[tier];

  const title = marketAvg
    ? `Based on similar listed prices (avg KSh ${marketAvg.toLocaleString()})`
    : "Based on similar listed prices";

  return (
    <span
      title={title}
      className={cn(
        "ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        config.cls,
      )}
    >
      {config.label}
    </span>
  );
}
