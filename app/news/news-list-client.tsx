"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Newspaper,
  ExternalLink,
  Clock,
  Eye,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsArticle } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1mo ago" : `${months}mo ago`;
}

function articleHref(article: NewsArticle): { href: string; external: boolean } {
  if (article.url === "#") {
    return { href: `/news/${article.slug}`, external: false };
  }
  return { href: article.url, external: true };
}

// ── Config ────────────────────────────────────────────────────────────────────

const SCOPE_TABS = [
  { label: "All",        value: "all" },
  { label: "Kenya",      value: "ke" },
  { label: "East Africa", value: "ea" },
  { label: "Africa",     value: "af" },
  { label: "Global",     value: "global" },
] as const;

const CATEGORY_PILLS = [
  { label: "All",    value: "all" },
  { label: "Kenya",  value: "kenya" },
  { label: "EV",     value: "ev" },
  { label: "SUV",    value: "suv" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Policy", value: "policy" },
  { label: "Pricing", value: "pricing" },
  { label: "Global", value: "global" },
];

const CATEGORY_COLORS: Record<string, string> = {
  kenya:      "bg-green-500/15 text-green-600 dark:text-green-400",
  ev:         "bg-blue-500/15 text-blue-500",
  suv:        "bg-purple-500/15 text-purple-500",
  hybrid:     "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  policy:     "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  pricing:    "bg-orange-500/15 text-orange-500",
  global:     "bg-surface-2 text-muted",
  "east-africa": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category.toLowerCase()] ?? "bg-surface-2 text-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        cls,
      )}
    >
      {category.replace(/-/g, " ")}
    </span>
  );
}

// ── Featured card ─────────────────────────────────────────────────────────────

function FeaturedCard({ article }: { article: NewsArticle }) {
  const { href, external } = articleHref(article);

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden hover-lift group mb-8">
      {article.image && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent uppercase tracking-wider">
            Featured
          </span>
          <CategoryBadge category={article.category} />
        </div>

        <h2 className="font-display text-2xl md:text-3xl font-medium leading-snug mb-3 group-hover:text-accent transition-colors">
          {article.title}
        </h2>

        {article.summary && (
          <p className="text-muted text-sm md:text-base leading-relaxed mb-5 line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="font-medium text-foreground">{article.source}</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(article.publishedAt)}
            </span>
            {article.viewCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {article.viewCount.toLocaleString()}
                </span>
              </>
            )}
          </div>

          {external ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 rounded-full bg-accent text-white px-5 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Read more <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center gap-2 h-9 rounded-full bg-accent text-white px-5 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Read more
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Article card ──────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  const { href, external } = articleHref(article);

  const inner = (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden hover-lift group h-full flex flex-col">
      {article.image ? (
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center">
          <Newspaper className="h-8 w-8 text-muted/30" />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4">
        <div className="mb-2">
          <CategoryBadge category={article.category} />
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-3 group-hover:text-accent transition-colors flex-1">
          {article.title}
        </h3>

        {article.summary && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-3">
            {article.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border gap-2">
          <span className="text-xs font-medium text-foreground truncate">
            {article.source}
          </span>
          <span className="text-xs text-muted shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex h-full">
        {inner}
      </a>
    );
  }
  return <Link href={href} className="flex h-full">{inner}</Link>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="aspect-[4/3] skeleton" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-20 skeleton rounded-full" />
        <div className="h-4 w-full skeleton" />
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-3 w-1/2 skeleton mt-3" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
        <Newspaper className="h-8 w-8 text-muted/50" />
      </div>
      <h3 className="font-semibold mb-2">No articles yet</h3>
      <p className="text-sm text-muted max-w-sm">
        Articles appear here once the news pipeline runs. Cron jobs fetch and
        process content automatically — check back shortly.
      </p>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface Props {
  initialArticles: NewsArticle[];
  initialScope: string;
}

export function NewsListClient({ initialArticles, initialScope }: Props) {
  const [activeScope, setActiveScope] = useState(initialScope);
  const [activeCategory, setActiveCategory] = useState("all");
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [page, setPage] = useState(1); // 1 = first 20 loaded
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialArticles.length >= 20);

  const fetchArticles = useCallback(
    async (scope: string, category: string) => {
      setLoading(true);
      setPage(1);
      try {
        const params = new URLSearchParams({ limit: "20", offset: "0" });
        if (scope !== "all") params.set("country", scope);
        if (category !== "all") params.set("category", category);
        const res = await fetch(`/api/news?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const fetched: NewsArticle[] = data.articles ?? [];
        setArticles(fetched);
        setHasMore(fetched.length >= 20);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = page * 20;
      const params = new URLSearchParams({
        limit: "20",
        offset: String(nextOffset),
      });
      if (activeScope !== "all") params.set("country", activeScope);
      if (activeCategory !== "all") params.set("category", activeCategory);
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: NewsArticle[] = data.articles ?? [];
      setArticles((prev) => [...prev, ...fetched]);
      setPage((p) => p + 1);
      setHasMore(fetched.length >= 20);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, activeScope, activeCategory]);

  function handleScopeChange(scope: string) {
    if (scope === activeScope) return;
    setActiveScope(scope);
    fetchArticles(scope, activeCategory);
  }

  function handleCategoryChange(cat: string) {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
    fetchArticles(activeScope, cat);
  }

  // Split featured from the rest
  const featuredArticle =
    articles.length > 0 && articles[0].featured ? articles[0] : null;
  const gridArticles = featuredArticle ? articles.slice(1) : articles;

  return (
    <div>
      {/* Scope tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 mb-5 w-fit">
        {SCOPE_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleScopeChange(value)}
            className={cn(
              "h-8 px-3 sm:px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              activeScope === value
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category pills — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto scroll-rail pb-1 mb-7">
        {CATEGORY_PILLS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleCategoryChange(value)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-all",
              activeCategory === value
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface text-muted hover:border-accent/50 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && articles.length === 0 && <EmptyState />}

      {!loading && articles.length > 0 && (
        <>
          {/* Featured article */}
          {featuredArticle && <FeaturedCard article={featuredArticle} />}

          {/* Article grid */}
          {gridArticles.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {gridArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className={cn(
                  "inline-flex items-center gap-2 h-11 rounded-full border border-border bg-surface px-8 text-sm font-semibold transition-all",
                  "hover:border-accent/40 hover:text-accent disabled:opacity-60",
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
