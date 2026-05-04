import { headers } from "next/headers";
import { Newspaper } from "lucide-react";
import type { NewsArticle } from "@/types";
import { NewsListClient } from "./news-list-client";

export const metadata = {
  title: "Automotive News — Agnora Motors",
  description:
    "Latest automotive news from Kenya, East Africa, Africa, and the world. EV updates, policy changes, new models, and market pricing.",
};

async function fetchInitialArticles(origin: string): Promise<NewsArticle[]> {
  try {
    const res = await fetch(`${origin}/api/news?limit=20&offset=0`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${proto}://${host}`;

  const initialArticles = await fetchInitialArticles(origin);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-surface/60 backdrop-blur-sm">
        <div className="container max-w-container py-8 px-4">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper className="h-5 w-5 text-accent" />
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">
              Automotive News
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-medium mb-1">
            Automotive News
          </h1>
          <p className="text-muted text-sm md:text-base">
            Kenya &middot; East Africa &middot; Africa &middot; Global
          </p>
        </div>
      </div>

      <div className="container max-w-container py-8 px-4">
        <NewsListClient initialArticles={initialArticles} initialScope="all" />
      </div>
    </div>
  );
}
