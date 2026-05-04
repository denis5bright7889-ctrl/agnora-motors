import type { RawArticle } from "./types";

const BASE = "https://gnews.io/api/v4/search";

export async function fetchGNews(query: string, max = 10): Promise<RawArticle[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) return [];

  try {
    const url = new URL(BASE);
    url.searchParams.set("q", query);
    url.searchParams.set("token", key);
    url.searchParams.set("lang", "en");
    url.searchParams.set("max", String(max));
    url.searchParams.set("sortby", "publishedAt");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json() as {
      articles?: Array<{
        title: string;
        url: string;
        source: { name: string };
        description: string | null;
        content: string | null;
        image: string | null;
        publishedAt: string;
      }>;
    };

    return (data.articles ?? [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: a.title.trim(),
        url: a.url,
        source: a.source?.name ?? "Unknown",
        content: a.content ?? undefined,
        description: a.description ?? undefined,
        image: a.image ?? undefined,
        publishedAt: a.publishedAt,
      }));
  } catch {
    return [];
  }
}
