"use client";

import { useState, useEffect } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { NewsArticle } from "@/types";
import { cn } from "@/lib/utils";

// The API may return NewsArticle objects (new format) or legacy NewsItem objects.
// summary is the NewsArticle field; we normalise to excerpt for display.
type NewsItem = Pick<NewsArticle, "id" | "source" | "url" | "image" | "category" | "publishedAt"> & {
  title: string;
  excerpt: string;
  summary?: string | null;
};

const CATEGORIES = ["All", "Luxury", "Electric", "SUV", "Hybrid", "Vintage"];

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  async function fetchNews() {
    setLoading(true);
    try {
      const res = await fetch("/api/news");
      const data = await res.json() as { articles?: NewsItem[]; news?: NewsItem[] };
      const raw = data.articles ?? data.news ?? [];
      setNews(raw.map(a => ({ ...a, excerpt: a.excerpt ?? a.summary ?? "" })));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchNews(); }, []);

  const filtered =
    activeCategory === "All"
      ? news
      : news.filter((n) => n.category === activeCategory);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition-all",
              activeCategory === cat
                ? "border-accent bg-accent-soft text-accent"
                : "border-border hover:border-accent/50 text-muted",
            )}
          >
            {cat}
          </button>
        ))}
        <button
          type="button"
          onClick={fetchNews}
          className="ml-auto h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-surface-2 transition-colors"
          aria-label="Refresh news"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted", loading && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-surface-2" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-16 rounded bg-surface-2" />
                <div className="h-4 w-full rounded bg-surface-2" />
                <div className="h-4 w-3/4 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">No news in this category.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((item, i) => (
            <NewsCard key={item.id} item={item} featured={i === 0 && activeCategory === "All"} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  const categoryColors: Record<string, string> = {
    Luxury:   "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    Electric: "bg-green-500/15 text-green-600 dark:text-green-400",
    SUV:      "bg-blue-500/15 text-blue-500",
    Hybrid:   "bg-teal-500/15 text-teal-500",
    Vintage:  "bg-purple-500/15 text-purple-500",
  };

  if (featured) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="sm:col-span-2 group flex flex-col sm:flex-row rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
      >
        <div className="sm:w-64 shrink-0 aspect-video sm:aspect-auto overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image ?? undefined}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div className="p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", categoryColors[item.category] ?? "bg-surface-2 text-muted")}>
              {item.category}
            </span>
            <span className="text-xs text-muted">Featured</span>
          </div>
          <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-accent transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-muted line-clamp-2 mb-3">{item.excerpt}</p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium">{item.source}</span>
            <span>·</span>
            <span>{formatDate(item.publishedAt)}</span>
            <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
    >
      <div className="aspect-[16/9] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image ?? undefined}
          alt={item.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className={cn("self-start rounded-full px-2.5 py-0.5 text-xs font-semibold mb-2", categoryColors[item.category] ?? "bg-surface-2 text-muted")}>
          {item.category}
        </span>
        <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-accent transition-colors flex-1">
          {item.title}
        </h3>
        <p className="text-xs text-muted line-clamp-2 mb-3">{item.excerpt}</p>
        <div className="flex items-center gap-2 text-xs text-muted mt-auto">
          <span className="font-medium">{item.source}</span>
          <span>·</span>
          <span>{formatDate(item.publishedAt)}</span>
          <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  );
}
