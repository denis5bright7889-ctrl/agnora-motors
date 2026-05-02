"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Shield, Gauge, Fuel, MapPin, Settings2, Banknote } from "lucide-react";
import type { Car } from "@/types";
import { formatPrice, formatMileage, cn } from "@/lib/utils";

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
  wishlistIds?: Set<string>;
  onWishlistToggle?: (id: string) => void;
}

export function CarCard({ car, priority, className, wishlistIds, onWishlistToggle }: Props) {
  const saved = wishlistIds?.has(car.id) ?? false;

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onWishlistToggle?.(car.id);
  }

  // Track recently viewed in localStorage
  function handleCardClick() {
    try {
      const KEY = "agnora_recently_viewed";
      const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
      const updated = [car.id, ...stored.filter((id) => id !== car.id)].slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  return (
    <article className={cn("group relative hover-lift", className)}>
      <Link href={`/cars/${car.slug}`} className="block focus-visible:outline-none" onClick={handleCardClick}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
          <Image
            src={car.images[0] ?? "/placeholder-car.jpg"}
            alt={`${car.year} ${car.make} ${car.model}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
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

      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save car"}
        onClick={handleWishlist}
        className={cn(
          "absolute right-3 top-3 hidden h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-all group-hover:flex hover:scale-110 z-10",
          saved ? "bg-accent text-white flex" : "bg-white/95 text-neutral-900",
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>

      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-medium leading-tight tracking-tight">
            <Link href={`/cars/${car.slug}`} className="hover:text-accent transition-colors" onClick={handleCardClick}>
              {car.year} {car.make} {car.model}
            </Link>
          </h3>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xs font-semibold text-muted">KSh</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-accent">
            {formatPrice(car.price)}
          </span>
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
