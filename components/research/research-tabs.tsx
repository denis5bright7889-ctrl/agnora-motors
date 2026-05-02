"use client";

import { useState } from "react";
import Link from "next/link";
import { Newspaper, Globe, BookOpen, Clock } from "lucide-react";
import { SocialFeed } from "./social-feed";
import { NewsFeed } from "./news-feed";
import { NewsletterForm } from "@/components/newsletter-form";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Article } from "@/types";

interface Props {
  articles: Article[];
  userId?: string;
  userName?: string;
  userImage?: string;
}

const TABS = [
  { id: "feed",     label: "Community",  icon: Globe },
  { id: "news",     label: "Global News", icon: Newspaper },
  { id: "articles", label: "Articles",    icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];

const categories = ["All", "Review", "News", "Buying Guide", "Ownership"] as const;

export function ResearchTabs({ articles, userId, userName, userImage }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("feed");

  return (
    <>
      {/* Tab bar */}
      <div className="sticky top-16 z-30 border-b border-border bg-background">
        <div className="container max-w-container">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === id
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="container max-w-container py-10 px-4">
        {activeTab === "feed" && (
          <div className="max-w-2xl mx-auto">
            <SocialFeed userId={userId} userName={userName} userImage={userImage} />
          </div>
        )}

        {activeTab === "news" && (
          <div>
            <div className="mb-6">
              <h2 className="font-display text-2xl font-medium mb-1">Global Automotive News</h2>
              <p className="text-sm text-muted">Latest launches, industry updates, and market trends from around the world.</p>
            </div>
            <NewsFeed />
          </div>
        )}

        {activeTab === "articles" && (
          <ArticlesTab articles={articles} />
        )}
      </div>
    </>
  );
}

function ArticlesTab({ articles }: { articles: Article[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered =
    activeCategory === "All"
      ? articles
      : articles.filter((a) => a.category === activeCategory);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const categoryColors: Record<string, string> = {
    Review: "bg-blue-500/15 text-blue-500",
    News: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    "Buying Guide": "bg-accent-soft text-accent",
    Ownership: "bg-purple-500/15 text-purple-500",
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-medium mb-1">Kenyan Car Reviews &amp; Guides</h2>
        <p className="text-sm text-muted">Real-world insight for Kenyan roads — reviews, import taxes, and market trends.</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-8 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "h-7 rounded-full border px-3.5 text-xs font-medium transition-all",
              activeCategory === cat
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface-2 text-muted hover:text-foreground hover:bg-surface",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">No articles in this category.</p>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <Link href={`/research/${featured.slug}`} className="group block mb-8">
              <div className="grid md:grid-cols-2 gap-6 rounded-3xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors">
                <div className="aspect-[16/10] md:aspect-auto overflow-hidden">
                  <img
                    src={featured.cover}
                    alt={featured.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", categoryColors[featured.category] ?? "bg-surface-2 text-muted")}>
                      {featured.category}
                    </span>
                    <span className="text-xs text-muted">Featured</span>
                  </div>
                  <h2 className="font-display text-xl font-medium mb-3 group-hover:text-accent transition-colors">{featured.title}</h2>
                  <p className="text-sm text-muted leading-relaxed mb-4">{featured.excerpt}</p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{featured.author}</span>
                    <span>·</span>
                    <span>{formatDate(featured.publishedAt)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{featured.readTime} min</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {rest.map((article) => (
                <Link
                  key={article.slug}
                  href={`/research/${article.slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={article.cover}
                      alt={article.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <span className={cn("self-start rounded-full px-2.5 py-1 text-xs font-semibold mb-3", categoryColors[article.category] ?? "bg-surface-2 text-muted")}>
                      {article.category}
                    </span>
                    <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-accent transition-colors flex-1">{article.title}</h3>
                    <p className="text-xs text-muted line-clamp-2 mb-3">{article.excerpt}</p>
                    <div className="flex items-center gap-2 text-xs text-muted mt-auto">
                      <span>{article.author}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTime} min</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Newsletter CTA */}
      <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 text-center">
        <h2 className="font-display text-2xl font-medium mb-2">Stay ahead of the Kenyan car market</h2>
        <p className="text-muted mb-6 max-w-md mx-auto">Weekly digest: new listings, market prices, CRSP updates, and the best buying guides.</p>
        <NewsletterForm />
      </div>
    </div>
  );
}
