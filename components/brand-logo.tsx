"use client";

import { useState } from "react";
import type { Brand } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  brand:     Brand;
  className?: string;
}

/**
 * Resolves a brand's logo in this order:
 *   1. brand.logoUrl   — explicit asset path (self-hosted SVG under
 *      /brand-logos/ for marks Simple Icons doesn't carry).
 *   2. brand.logoSlug  — Simple Icons CDN (https://cdn.simpleicons.org/{slug}).
 *   3. lettered chip   — first letter of the brand name.
 *
 * Trademark rights remain with each brand's owner; usage for identifying
 * products of that brand on a marketplace is standard nominative use.
 */
export function BrandLogo({ brand, className }: Props) {
  const [failed, setFailed] = useState(false);

  const src =
    brand.logoUrl  ? brand.logoUrl :
    brand.logoSlug ? `https://cdn.simpleicons.org/${brand.logoSlug}` :
    null;

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "font-display text-3xl text-muted/40 group-hover:text-accent transition-colors",
          className,
        )}
      >
        {brand.name[0]}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "h-9 w-9 object-contain transition-transform group-hover:scale-110",
        className,
      )}
    />
  );
}
