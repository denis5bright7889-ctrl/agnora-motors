"use client";

import Link from "next/link";
import { Heart, Shield, Gauge, Fuel, MapPin, Settings2, Banknote } from "lucide-react";
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
    <article className={cn("group relative hover-lift", className)}>
      <Link href={`/cars/${car.slug}`} className="block focus-visible:outline-none" onClick={handleCardClick}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
          {/* Plain <img>: same defensive choice as the form / gallery so a
              missing remotePatterns entry can't break listing cards.
              `priority` becomes fetchpriority="high" for the LCP card. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={car.images[0] ?? "/placeholder-car.jpg"}
            alt={`${car.year} ${car.make} ${car.model}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {car.verified && (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-900 backdrop-blur">
              <Shield className="h-3 w-3" /> Verified
            </div>
          )}
          <div className="absolute right-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-900 backdrop-blur">
            {CONDITION_LABELS[car.condition] ?? car.condition}
          </div>
          {(car.financingAvailable || car.hirePurchaseAvailable) && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-green-600/90 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
              <Banknote className="h-3 w-3" />
              {car.hirePurchaseAvailable ? "Hire Purchase" : "Finance"}
            </div>
          )}
        </div>
      </Link>

      {/* Wishlist — always visible on touch, fades in on hover for pointer devices */}
      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save car"}
        onClick={handleWishlist}
        className={cn(
          "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-all active:scale-90 z-10",
          saved
            ? "bg-accent text-white shadow-lg shadow-accent/30"
            : "bg-white/90 text-neutral-900 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>

      <div className="mt-4 space-y-3">
        <div>
          <h3 className="font-display text-lg font-medium leading-tight tracking-tight">
            <Link href={`/cars/${car.slug}`} className="hover:text-accent transition-colors" onClick={handleCardClick}>
              {car.year} {car.make} {car.model}
            </Link>
          </h3>
        </div>

        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-xs font-semibold text-muted">KSh</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-accent">
            {formatPrice(car.price)}
          </span>
          {car.priceTier && <PriceTierChip tier={car.priceTier} marketAvg={car.marketAvg} />}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          <li className="inline-flex items-center gap-1.5">
            <Gauge className="h-3 w-3" /> {formatMileage(car.mileage)}
          </li>
          <li className="inline-flex items-center gap-1.5 capitalize">
            <Fuel className="h-3 w-3" /> {car.fuel}
          </li>
          <li className="inline-flex items-center gap-1.5 capitalize">
            <Settings2 className="h-3 w-3" /> {car.transmission}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {car.location}
          </li>
        </ul>
      </div>
    </article>
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
