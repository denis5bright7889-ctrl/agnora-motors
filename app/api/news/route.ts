import { NextResponse } from "next/server";
import { getNewsArticles, isDbConfigured } from "@/lib/db";
import { STATIC_NEWS } from "@/lib/news/static-news";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const country  = searchParams.get("country") ?? undefined;
  const search   = searchParams.get("search") ?? undefined;
  const limit    = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset   = Number(searchParams.get("offset") ?? 0);

  if (isDbConfigured()) {
    try {
      const articles = await getNewsArticles({ category, country, search, limit, offset });
      if (articles.length > 0) {
        return NextResponse.json({ articles, source: "db" });
      }
    } catch {
      // fall through to static
    }
  }

  // Static fallback — filter by category/country if requested
  let filtered = STATIC_NEWS as typeof STATIC_NEWS;
  if (category && category !== "all") {
    filtered = filtered.filter((a) => a.category === category);
  }
  if (country && country !== "all") {
    filtered = filtered.filter((a) => a.country === country);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.summary ?? "").toLowerCase().includes(q),
    );
  }

  return NextResponse.json({ articles: filtered.slice(offset, offset + limit), source: "static" });
}
