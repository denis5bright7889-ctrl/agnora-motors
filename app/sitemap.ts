import type { MetadataRoute } from "next";
import { getNewsArticles, getResearchArticles, isDbConfigured } from "@/lib/db";
import { articles as staticArticles } from "@/data/content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://agnora-motors.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    { url: BASE_URL,               lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/cars`,     lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/news`,     lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE_URL}/research`, lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/finance`,  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
    { url: `${BASE_URL}/sell`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Static research articles from data/content.ts
  for (const article of staticArticles) {
    routes.push({
      url: `${BASE_URL}/research/${article.slug}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  if (isDbConfigured()) {
    try {
      const [newsArticles, researchArticles] = await Promise.all([
        getNewsArticles({ limit: 500 }),
        getResearchArticles({ limit: 200 }),
      ]);

      for (const a of newsArticles) {
        routes.push({
          url: `${BASE_URL}/news/${a.slug}`,
          lastModified: new Date(a.publishedAt),
          changeFrequency: "weekly",
          priority: 0.65,
        });
      }

      for (const a of researchArticles) {
        routes.push({
          url: `${BASE_URL}/research/${a.slug}`,
          lastModified: new Date(a.updatedAt),
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    } catch {
      // DB unavailable — static routes only
    }
  }

  return routes;
}
