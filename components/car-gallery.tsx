"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  images: string[];
  alt: string;
}

export function CarGallery({ images, alt }: Props) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(
    () => setSelected((i) => (i === 0 ? images.length - 1 : i - 1)),
    [images.length],
  );
  const next = useCallback(
    () => setSelected((i) => (i === images.length - 1 ? 0 : i + 1)),
    [images.length],
  );

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, prev, next]);

  useEffect(() => {
    document.body.style.overflow = lightbox ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightbox]);

  return (
    <>
      {/* Main image */}
      <div
        className="group relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-2 cursor-zoom-in"
        onClick={() => setLightbox(true)}
      >
        <Image
          src={images[selected]}
          alt={`${alt} — photo ${selected + 1}`}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          className="object-cover transition-transform duration-500"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="h-3 w-3" />
          View {images.length} photos
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scroll-rail pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                "relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                i === selected ? "border-accent" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <Image
                src={img}
                alt={`${alt} thumbnail ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative max-h-[85vh] max-w-5xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selected]}
              alt={`${alt} — photo ${selected + 1}`}
              width={1200}
              height={800}
              className="object-contain max-h-[85vh] w-full rounded-xl"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setSelected(i); }}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selected ? "w-6 bg-white" : "w-1.5 bg-white/40",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}