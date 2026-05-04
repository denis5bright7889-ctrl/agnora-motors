import type { RawArticle } from "./types";

const BASE = "https://newsapi.org/v2/everything";

export async function fetchNewsAPI(query: string, pageSize = 20): Promise<RawArticle[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];

  try {
    const url = new URL(BASE);
    url.searchParams.set("q", query);
    url.searchParams.set("apiKey", key);
    url.searchParams.set("language", "en");
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("sortBy", "publishedAt");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json() as {
      articles?: Array<{
        title: string;
        url: string;
        source: { name: string };
        description: string | null;
        content: string | null;
        urlToImage: string | null;
        publishedAt: string;
      }>;
    };

    return (data.articles ?? [])
      .filter((a) => a.title && a.url && !a.title.includes("[Removed]"))
      .map((a) => ({
        title: a.title.trim(),
        url: a.url,
        source: a.source?.name ?? "Unknown",
        content: a.content ?? undefined,
        description: a.description ?? undefined,
        image: a.urlToImage ?? undefined,
        publishedAt: a.publishedAt,
      }));
  } catch {
    return [];
  }
}
