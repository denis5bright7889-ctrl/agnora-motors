"use client";

import { useState } from "react";
import type { Brand } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  brand:     Brand;
  className?: string;
}

/**
 * Renders a brand's logo from the Simple Icons public CDN
 * (https://cdn.simpleicons.org). The icons themselves are community-maintained
 * SVGs — trademark rights remain with each brand's owner; usage for
 * identifying products of that brand on a marketplace is standard nominative
 * use.
 *
 * If the brand has no logoSlug OR the CDN request fails (404, network
 * error, slug typo), we fall back to a lettered chip so the grid never
 * shows a broken-image icon.
 *
 * To self-host instead: change the `src` to `/brand-logos/${brand.logoSlug}.svg`
 * and drop SVGs into /public/brand-logos/.
 */
export function BrandLogo({ brand, className }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = brand.logoSlug && !failed;

  if (!showImage) {
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
      src={`https://cdn.simpleicons.org/${brand.logoSlug}`}
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
