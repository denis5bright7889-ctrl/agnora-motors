"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Newspaper,
  FileText,
  Check,
  X,
  Trash2,
  Star,
  StarOff,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsArticle, ResearchArticle } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type NewsStatus = "all" | "published" | "pending" | "rejected";
type ResearchStatus = "all" | "published" | "draft";
type ActiveTab = "news" | "research";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

// ── Badges ────────────────────────────────────────────────────────────────────

function NewsStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    published: { cls: "bg-green-500/15 text-green-600 dark:text-green-400",   label: "Published" },
    pending:   { cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", label: "Pending" },
    rejected:  { cls: "bg-red-500/15 text-red-500",                            label: "Rejected" },
  };
  const { cls, label } = map[status] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
}

function CountryBadge({ country }: { country: string }) {
  const map: Record<string, string> = {
    ke: "🇰🇪 Kenya",
    ea: "🌍 East Africa",
    af: "🌍 Africa",
    global: "🌐 Global",
  };
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted whitespace-nowrap">
      {map[country] ?? country}
    </span>
  );
}

function ResearchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    published: { cls: "bg-green-500/15 text-green-600 dark:text-green-400", label: "Published" },
    draft:     { cls: "bg-surface-2 text-muted",                            label: "Draft" },
  };
  const { cls, label } = map[status] ?? map.draft;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {label}
    </span>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 skeleton rounded" style={{ width: j === 0 ? "80%" : "60%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── News tab ──────────────────────────────────────────────────────────────────

function NewsTab() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<NewsStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 50;

  const fetchArticles = useCallback(async (s: NewsStatus, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: "news",
        limit: String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
      });
      if (s !== "all") params.set("status", s);
      const res = await fetch(`/api/admin/content?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: NewsArticle[] = data.articles ?? [];
      setArticles(fetched);
      setTotal(data.total ?? fetched.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(status, page);
  }, [status, page, fetchArticles]);

  async function patch(id: string, action: string, value?: string | boolean) {
    setProcessing(id);
    try {
      await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "news", id, action, value }),
      });
      if (action === "delete") {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      } else if (action === "status") {
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: value as NewsArticle["status"] } : a)),
        );
      } else if (action === "featured") {
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, featured: Boolean(value) } : a)),
        );
      }
    } finally {
      setProcessing(null);
    }
  }

  const filtered = search
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.source.toLowerCase().includes(search.toLowerCase()),
      )
    : articles;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or source…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-muted shrink-0" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as NewsStatus);
              setPage(0);
            }}
            className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => fetchArticles(status, page)}
            className="h-10 w-10 rounded-xl border border-border bg-surface-2 flex items-center justify-center hover:bg-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-muted" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                  Featured
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden xl:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <SkeletonRows count={8} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    No articles found.
                  </td>
                </tr>
              ) : (
                filtered.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      "hover:bg-surface-2/50 transition-colors",
                      processing === article.id && "opacity-50 pointer-events-none",
                    )}
                  >
                    {/* Title */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="font-medium leading-snug">
                            {truncate(article.title, 60)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                      >
                        {article.source}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted capitalize">
                        {article.category.replace(/-/g, " ")}
                      </span>
                    </td>

                    {/* Country */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <CountryBadge country={article.country} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <NewsStatusBadge status={article.status} />
                    </td>

                    {/* Featured toggle */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <button
                        onClick={() => patch(article.id, "featured", !article.featured)}
                        title={article.featured ? "Remove featured" : "Set featured"}
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                          article.featured
                            ? "bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25"
                            : "bg-surface-2 text-muted hover:text-foreground",
                        )}
                      >
                        {article.featured ? (
                          <Star className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <StarOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted whitespace-nowrap">
                      {formatDate(article.publishedAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {article.status !== "published" && (
                          <button
                            onClick={() => patch(article.id, "status", "published")}
                            title="Approve"
                            className="h-7 w-7 flex items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {article.status !== "rejected" && (
                          <button
                            onClick={() => patch(article.id, "status", "rejected")}
                            title="Reject"
                            className="h-7 w-7 flex items-center justify-center rounded-full bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm("Delete this article? This cannot be undone.")) {
                              patch(article.id, "delete");
                            }
                          }}
                          title="Delete"
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-surface-2 text-muted hover:bg-red-500/15 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2/50">
            <p className="text-xs text-muted">
              Page {page + 1} of {pageCount} &middot;{" "}
              {total > 0 ? `${total.toLocaleString()} total` : `${filtered.length} shown`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Research tab ──────────────────────────────────────────────────────────────

function ResearchTab() {
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ResearchStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 50;

  const fetchArticles = useCallback(async (s: ResearchStatus, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: "research",
        limit: String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
      });
      if (s !== "all") params.set("status", s);
      const res = await fetch(`/api/admin/content?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: ResearchArticle[] = data.articles ?? [];
      setArticles(fetched);
      setTotal(data.total ?? fetched.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(status, page);
  }, [status, page, fetchArticles]);

  async function patch(id: string, action: string, value?: string | boolean) {
    setProcessing(id);
    try {
      await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "research", id, action, value }),
      });
      if (action === "delete") {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      } else if (action === "status") {
        setArticles((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: value as ResearchArticle["status"] } : a,
          ),
        );
      } else if (action === "featured") {
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, featured: Boolean(value) } : a)),
        );
      }
    } finally {
      setProcessing(null);
    }
  }

  const filtered = search
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.author.toLowerCase().includes(search.toLowerCase()),
      )
    : articles;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-muted shrink-0" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ResearchStatus);
              setPage(0);
            }}
            className="h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent text-foreground"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <button
            onClick={() => fetchArticles(status, page)}
            className="h-10 w-10 rounded-xl border border-border bg-surface-2 flex items-center justify-center hover:bg-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-muted" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                  Featured
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden xl:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <SkeletonRows count={8} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    No research articles found.
                  </td>
                </tr>
              ) : (
                filtered.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      "hover:bg-surface-2/50 transition-colors",
                      processing === article.id && "opacity-50 pointer-events-none",
                    )}
                  >
                    {/* Title */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium leading-snug">
                        {truncate(article.title, 60)}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted capitalize">
                        {article.category.replace(/-/g, " ")}
                      </span>
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted">{article.author}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <ResearchStatusBadge status={article.status} />
                    </td>

                    {/* Featured toggle */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <button
                        onClick={() => patch(article.id, "featured", !article.featured)}
                        title={article.featured ? "Remove featured" : "Set featured"}
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                          article.featured
                            ? "bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25"
                            : "bg-surface-2 text-muted hover:text-foreground",
                        )}
                      >
                        {article.featured ? (
                          <Star className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <StarOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted whitespace-nowrap">
                      {formatDate(article.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {article.status === "draft" ? (
                          <button
                            onClick={() => patch(article.id, "status", "published")}
                            title="Publish"
                            className="inline-flex items-center gap-1 h-7 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 px-2.5 text-[10px] font-semibold transition-colors"
                          >
                            <Check className="h-3 w-3" /> Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => patch(article.id, "status", "draft")}
                            title="Unpublish"
                            className="inline-flex items-center gap-1 h-7 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/25 px-2.5 text-[10px] font-semibold transition-colors"
                          >
                            <X className="h-3 w-3" /> Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm("Delete this article? This cannot be undone.")) {
                              patch(article.id, "delete");
                            }
                          }}
                          title="Delete"
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-surface-2 text-muted hover:bg-red-500/15 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2/50">
            <p className="text-xs text-muted">
              Page {page + 1} of {pageCount} &middot;{" "}
              {total > 0 ? `${total.toLocaleString()} total` : `${filtered.length} shown`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("news");

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: "news",     label: "News Articles",     icon: Newspaper },
    { id: "research", label: "Research Articles",  icon: FileText },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-medium">Content Management</h1>
        <p className="text-sm text-muted mt-1">
          Review, approve, and manage news and research articles.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-all",
              activeTab === id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "news"     && <NewsTab />}
      {activeTab === "research" && <ResearchTab />}
    </div>
  );
}
