"use client";

import { useState, useEffect, useRef, useId, useCallback } from "react";
import { Search, Loader2, TrendingUp, Clock, Building2, Car, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type {
  SuggestResponse, SuggestMake, SuggestModel, SuggestDealer,
} from "@/app/api/search/suggest/route";

const RECENT_KEY  = "agnora_recent_searches";
const MIN_Q_LEN   = 2;
const DEBOUNCE_MS = 180;

type SuggestionKind = "make" | "model" | "dealer" | "popular" | "recent";
interface SuggestionItem {
  kind:    SuggestionKind;
  label:   string;
  sub?:    string;
  href:    string;
  payload: string; // canonical text we record into recent searches
}

interface Props {
  value:           string;
  onChange:        (v: string) => void;
  onSubmit?:       (v: string) => void;
  placeholder?:    string;
  inputClassName?: string;
  panelClassName?: string;
  /** When true, the dropdown is rendered inline (relative); used inside a modal. */
  inline?:         boolean;
  /** When true, focuses the input on mount (mobile overlay). */
  autoFocus?:      boolean;
  /** Tag for analytics so we can tell hero-vs-listing-vs-mobile apart. */
  source?:         string;
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, 5) : [];
  } catch { return []; }
}

export function recordRecentSearch(q: string): void {
  if (typeof window === "undefined" || !q.trim()) return;
  try {
    const prev = loadRecentSearches();
    const next = [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-soft text-accent rounded px-0.5 font-semibold">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function buildItems(
  response: SuggestResponse | null,
  recent: string[],
): { groups: { title: string; icon: React.ElementType; items: SuggestionItem[] }[]; flat: SuggestionItem[] } {
  if (!response) return { groups: [], flat: [] };

  const groups: { title: string; icon: React.ElementType; items: SuggestionItem[] }[] = [];

  if (response.makes.length) {
    groups.push({
      title: "Makes",
      icon:  Car,
      items: response.makes.map((m: SuggestMake): SuggestionItem => ({
        kind: "make",
        label: m.name,
        sub: "Make",
        href: `/cars?make=${encodeURIComponent(m.slug)}`,
        payload: m.name,
      })),
    });
  }

  if (response.models.length) {
    groups.push({
      title: "Models",
      icon:  Car,
      items: response.models.map((m: SuggestModel): SuggestionItem => ({
        kind: "model",
        label: m.name,
        sub: `Model • ${m.makeName}`,
        href: `/cars?make=${encodeURIComponent(m.makeSlug)}&model=${encodeURIComponent(m.slug)}`,
        payload: `${m.makeName} ${m.name}`,
      })),
    });
  }

  if (response.dealers.length) {
    groups.push({
      title: "Dealers",
      icon:  Building2,
      items: response.dealers.map((d: SuggestDealer): SuggestionItem => ({
        kind: "dealer",
        label: d.businessName,
        sub: `Dealer${d.location ? ` • ${d.location}` : ""}`,
        href: `/cars?q=${encodeURIComponent(d.businessName)}`,
        payload: d.businessName,
      })),
    });
  }

  // Only show popular/recent when there's room or when query is short — we
  // never want to drown out specific matches, so they go last.
  if (response.popularSearches.length) {
    groups.push({
      title: "Popular searches",
      icon:  TrendingUp,
      items: response.popularSearches.map((s: string): SuggestionItem => ({
        kind: "popular",
        label: s,
        sub:  "Popular search",
        href: `/cars?q=${encodeURIComponent(s)}`,
        payload: s,
      })),
    });
  }

  if (recent.length) {
    groups.push({
      title: "Recent searches",
      icon:  Clock,
      items: recent.map((s): SuggestionItem => ({
        kind: "recent",
        label: s,
        sub:  "Recent",
        href: `/cars?q=${encodeURIComponent(s)}`,
        payload: s,
      })),
    });
  }

  const flat = groups.flatMap((g) => g.items);
  return { groups, flat };
}

export function SearchAutocomplete({
  value, onChange, onSubmit,
  placeholder = "Search by make, model, stock number, dealer, body type, or keyword",
  inputClassName,
  panelClassName,
  inline,
  autoFocus,
  source = "search",
}: Props) {
  const router        = useRouter();
  const containerRef  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const [open,        setOpen]        = useState(false);
  const [resp,        setResp]        = useState<SuggestResponse | null>(null);
  const [recent,      setRecent]      = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const listboxId = useId();

  useEffect(() => { setRecent(loadRecentSearches()); }, []);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  // Debounced suggestion fetch.
  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_Q_LEN) {
      setResp({
        query: q, expanded: "",
        makes: [], models: [], dealers: [],
        popularSearches: [], // popular shown only when query matches at least one
        recentSearches:  [],
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        const data: SuggestResponse = await r.json();
        setResp(data);
        const totalShown =
          data.makes.length + data.models.length + data.dealers.length + data.popularSearches.length;
        if (totalShown > 0) {
          trackEvent("search_suggestion_shown", { q, count: totalShown, source });
        }
      } catch { /* swallow */ }
      finally { setLoading(false); }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, source]);

  // Click outside → close.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { groups, flat } = buildItems(resp, value.trim() ? [] : recent);

  const selectAt = useCallback((idx: number) => {
    const item = flat[idx];
    if (!item) return;
    trackEvent("search_suggestion_clicked", { q: value, kind: item.kind, label: item.label, source });
    recordRecentSearch(item.payload);
    setOpen(false);
    onChange(item.payload);
    router.push(item.href);
  }, [flat, onChange, router, source, value]);

  function submitFreeText() {
    const q = value.trim();
    if (!q) return;
    trackEvent("search_submitted", { q, source });
    recordRecentSearch(q);
    setOpen(false);
    if (onSubmit) onSubmit(q);
    else router.push(`/cars?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault(); setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIdx >= 0 && flat[activeIdx]) selectAt(activeIdx);
      else submitFreeText();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const showPanel = open && (loading || flat.length > 0 || (value.trim().length >= MIN_Q_LEN && !loading));
  const q = value.trim();

  return (
    <div ref={containerRef} className={inline ? "relative" : "relative w-full"}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open ? "true" : "false"}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIdx >= 0 ? `${listboxId}-${activeIdx}` : undefined}
          className={cn(
            "w-full h-12 rounded-full border border-border bg-surface-2 pl-11 pr-10 text-sm outline-none focus:border-accent placeholder:text-muted",
            inputClassName,
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted" aria-hidden />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { onChange(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            inline
              ? "mt-3 rounded-2xl border border-border bg-surface overflow-hidden"
              : "absolute z-40 mt-2 w-full rounded-2xl border border-border bg-surface shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden",
            panelClassName,
          )}
        >
          {flat.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">
              {loading ? "Searching…" : `No matches for "${q}". Try a different keyword.`}
            </div>
          ) : (
            <SuggestionGroups
              groups={groups}
              activeIdx={activeIdx}
              listboxId={listboxId}
              query={q}
              onPick={selectAt}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionGroups({
  groups, activeIdx, listboxId, query, onPick,
}: {
  groups: { title: string; icon: React.ElementType; items: SuggestionItem[] }[];
  activeIdx: number;
  listboxId: string;
  query: string;
  onPick: (idx: number) => void;
}) {
  let cursor = 0;
  return (
    <div className="max-h-[60vh] overflow-y-auto py-1.5">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.title} className="py-1">
            <p className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
              <GroupIcon className="h-3 w-3" /> {group.title}
            </p>
            {group.items.map((item) => {
              const idx = cursor++;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={`${group.title}-${item.label}-${idx}`}
                  id={`${listboxId}-${idx}`}
                  role="option"
                  aria-selected={isActive ? "true" : "false"}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onPick(idx); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                    isActive ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {highlight(item.label, query)}
                    </span>
                    {item.sub && (
                      <span className="block text-[11px] text-muted truncate">{item.sub}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
