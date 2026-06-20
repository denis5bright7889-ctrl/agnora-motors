"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { SearchAutocomplete } from "./search-autocomplete";
import { cn } from "@/lib/utils";

interface TriggerProps {
  value:       string;
  placeholder?: string;
  activeFiltersCount?: number;
  onOpenFilters?: () => void;
  onChange:     (v: string) => void;
  onSubmit?:    (v: string) => void;
}

/**
 * The visible search "input" on mobile sticky bars. It's really a button styled
 * as an input. Tapping it opens a full-screen overlay where the real
 * autocomplete lives — that pattern keeps the dropdown from fighting the
 * keyboard, the soft-back, and the page scroll.
 */
export function MobileSearchTrigger({
  value, placeholder = "Search make, model, dealer…",
  activeFiltersCount, onOpenFilters,
  onChange, onSubmit,
}: TriggerProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes the overlay (helps tablets with hardware keyboards).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className="relative flex-1 h-11 rounded-full border border-border bg-surface-2 pl-10 pr-4 text-sm text-left text-muted hover:bg-surface transition-colors flex items-center"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          {value
            ? <span className="text-foreground truncate">{value}</span>
            : <span className="truncate">{placeholder}</span>}
        </button>
        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            aria-label="Open filters"
            className={cn(
              "flex shrink-0 items-center gap-1.5 h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              activeFiltersCount
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface-2",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFiltersCount ? activeFiltersCount : ""}
          </button>
        )}
      </div>

      {open && (
        <MobileSearchOverlay
          initialValue={value}
          placeholder={placeholder}
          onClose={() => setOpen(false)}
          onChange={onChange}
          onSubmit={(q) => { onSubmit?.(q); setOpen(false); }}
        />
      )}
    </>
  );
}

interface OverlayProps {
  initialValue: string;
  placeholder?: string;
  onClose:      () => void;
  onChange:     (v: string) => void;
  onSubmit?:    (v: string) => void;
}

function MobileSearchOverlay({
  initialValue, placeholder, onClose, onChange, onSubmit,
}: OverlayProps) {
  const [localValue, setLocalValue] = useState(initialValue);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="h-10 w-10 rounded-full flex items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <SearchAutocomplete
            value={localValue}
            onChange={(v) => { setLocalValue(v); onChange(v); }}
            onSubmit={(q) => onSubmit?.(q)}
            placeholder={placeholder}
            inline
            autoFocus
            source="mobile-overlay"
          />
        </div>
      </div>
    </div>
  );
}
