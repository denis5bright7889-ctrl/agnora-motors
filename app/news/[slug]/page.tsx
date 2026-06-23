import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  ChevronRight,
  ArrowLeft,
  Clock,
  Eye,
  ExternalLink,
  BookOpen,
  MapPin,
} from "lucide-react";
import type { Metadata } from "next";
import type { NewsArticle, Car } from "@/types";
import { cn } from "@/lib/utils";
import { getRelatedCarsForArticle, isDbConfigured } from "@/lib/db";
import { KenyaImpactWidget } from "./kenya-impact-widget";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readTimeMinutes(text: string | null): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

const COUNTRY_LABELS: Record<string, string> = {
  ke: "Kenya",
  ea: "East Africa",
  af: "Africa",
  global: "Global",
};

const CATEGORY_COLORS: Record<string, string> = {
  kenya:        "bg-green-500/15 text-green-600 dark:text-green-400",
  ev:           "bg-blue-500/15 text-blue-500",
  suv:          "bg-purple-500/15 text-purple-500",
  hybrid:       "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  policy:       "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  pricing:      "bg-orange-500/15 text-orange-500",
  global:       "bg-surface-2 text-muted",
  "east-africa": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

async function fetchArticle(slug: string, origin: string): Promise<NewsArticle | null> {
  try {
    const res = await fetch(`${origin}/api/news/${slug}`, {
      next: { revalidate: 600 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.article ?? null;
  } catch {
    return null;
  }
}

async function fetchRelated(
  category: string,
  excludeSlug: string,
  origin: string,
): Promise<NewsArticle[]> {
  try {
    const res = await fetch(
      `${origin}/api/news?category=${encodeURIComponent(category)}&limit=4`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles as NewsArticle[]).filter((a) => a.slug !== excludeSlug).slice(0, 4);
  } catch {
    return [];
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const origin = await getOrigin();
  const article = await fetchArticle(slug, origin);

  if (!article) {
    return { title: "Article not found — Agnora Motors" };
  }

  return {
    title: `${article.title} — Agnora Motors`,
    description: article.summary ?? undefined,
    openGraph: {
      title: article.title,
      description: article.summary ?? undefined,
      type: "article",
      publishedTime: article.publishedAt,
      tags: article.tags,
      images: article.image
        ? [{ url: article.image, width: 1200, height: 630, alt: article.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary ?? undefined,
      images: article.image ? [article.image] : [],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const origin = await getOrigin();
  const article = await fetchArticle(slug, origin);

  if (!article) notFound();

  const related = await fetchRelated(article.category, slug, origin);
  const bodyText = article.content ?? article.summary ?? "";

  // Related cars fetched directly server-side — no API round-trip.
  // Hides itself when DB is empty or no makes match the article text.
  const relatedCars: Car[] = isDbConfigured()
    ? await getRelatedCarsForArticle({
        title: article.title,
        body:  article.summary ?? article.content ?? "",
        limit: 4,
      }).catch(() => [])
    : [];
  const readTime = readTimeMinutes(bodyText);
  const countryLabel = COUNTRY_LABELS[article.country] ?? article.country;
  const catCls = CATEGORY_COLORS[article.category.toLowerCase()] ?? "bg-surface-2 text-muted";
  const isExternal = article.url && article.url !== "#";

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    image: article.image ?? undefined,
    datePublished: article.publishedAt,
    dateModified: article.createdAt,
    author: {
      "@type": "Organization",
      name: article.source,
      url: article.sourceUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Agnora Motors",
      url: "https://agnora-motors.com",
    },
    keywords: article.tags.join(", "),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD — rendered via a non-script element so React doesn't warn about
          encountering a <script> tag during client render. Search crawlers read
          the application/ld+json payload from the SSR'd HTML all the same. */}
      <div
        dangerouslySetInnerHTML={{
          __html: `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
        }}
      />
        {/* Breadcrumb */}
        <div className="border-b border-border bg-surface/60 backdrop-blur-sm">
          <div className="container max-w-container py-3 px-4 flex items-center gap-2 text-sm text-muted overflow-hidden">
            <Link href="/" className="hover:text-foreground transition-colors shrink-0">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link href="/news" className="hover:text-foreground transition-colors shrink-0">
              News
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground truncate">{article.title}</span>
          </div>
        </div>

        <div className="container max-w-container py-10 px-4">
          <div className="grid lg:grid-cols-[1fr_320px] gap-12">
            {/* ── Main article ── */}
            <article>
              <Link
                href="/news"
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to News
              </Link>

              {/* Hero image */}
              {article.image && (
                <div className="rounded-3xl overflow-hidden aspect-video mb-8">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Category + country */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize",
                    catCls,
                  )}
                >
                  {article.category.replace(/-/g, " ")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {countryLabel}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-display text-3xl lg:text-4xl font-medium leading-tight mb-5">
                {article.title}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 pb-6 border-b border-border">
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-accent transition-colors"
                >
                  {article.source}
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
                <span className="h-1 w-1 rounded-full bg-border hidden sm:block" />
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(article.publishedAt)}
                </span>
                {article.viewCount > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-border hidden sm:block" />
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      <Eye className="h-3.5 w-3.5" />
                      {article.viewCount.toLocaleString()} views
                    </span>
                  </>
                )}
                <span className="h-1 w-1 rounded-full bg-border hidden sm:block" />
                <span className="text-sm text-muted">{readTime} min read</span>
              </div>

              {/* Tags */}
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Kenya Impact overlay — the value buyers can't get on Motor1
                  or Carscoops. Auto-hides when the ingest cron hasn't
                  populated impactScore / kenyaSummary yet. */}
              <KenyaImpactWidget
                impactScore={article.impactScore}
                kenyaSummary={article.kenyaSummary}
                relatedCars={relatedCars}
              />

              {/* Article body */}
              {bodyText ? (
                <div className="space-y-4 text-[15px] leading-relaxed text-muted">
                  {bodyText.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{para.trim()}</p>
                  ))}
                </div>
              ) : (
                <p className="text-muted italic text-sm">No content preview available.</p>
              )}

              {/* Read full article CTA — only when we have no full content */}
              {!article.content && isExternal && (
                <div className="mt-10 rounded-2xl border border-border bg-surface-2 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold mb-0.5">Read the full article</p>
                    <p className="text-sm text-muted">
                      Continue reading on <span className="font-medium">{article.source}</span>
                    </p>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 h-10 rounded-full bg-accent text-white px-6 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Open article <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}

              {/* Back button */}
              <div className="mt-10 pt-8 border-t border-border">
                <Link
                  href="/news"
                  className="inline-flex items-center gap-2 h-10 rounded-full border border-border bg-surface px-5 text-sm font-medium text-muted hover:text-foreground hover:border-accent/40 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to News
                </Link>
              </div>
            </article>

            {/* ── Sidebar ── */}
            <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
              {/* Related articles */}
              {related.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-4 w-4 text-accent" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Related articles
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {related.map((rel) => {
                      const { href, external } = articleHrefFromArticle(rel);
                      const CardInner = (
                        <div className="group flex gap-3 items-start">
                          {rel.image ? (
                            <div className="h-14 w-20 shrink-0 rounded-xl overflow-hidden">
                              <img
                                src={rel.image}
                                alt={rel.title}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ) : (
                            <div className="h-14 w-20 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-muted/40" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                              {rel.title}
                            </p>
                            <p className="text-xs text-muted mt-1">
                              {rel.source} · {formatDate(rel.publishedAt)}
                            </p>
                          </div>
                        </div>
                      );

                      return external ? (
                        <a
                          key={rel.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {CardInner}
                        </a>
                      ) : (
                        <Link key={rel.id} href={href}>
                          {CardInner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Browse cars CTA */}
              <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-5">
                <p className="font-semibold mb-1 text-sm">Looking for a car?</p>
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  Browse thousands of verified listings from trusted dealers across Kenya.
                </p>
                <Link
                  href="/cars"
                  className="block text-center h-9 leading-9 rounded-full bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Browse listings
                </Link>
              </div>
            </aside>
          </div>
        </div>
    </div>
  );
}

// ── Utility used in sidebar (server-side, so define locally) ──────────────────

function articleHrefFromArticle(article: NewsArticle): { href: string; external: boolean } {
  if (article.url === "#") {
    return { href: `/news/${article.slug}`, external: false };
  }
  return { href: article.url, external: true };
}
