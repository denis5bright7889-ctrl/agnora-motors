import { fetchNewsAPI }   from "./newsapi";
import { fetchGNews }     from "./gnews";
import { fetchRssFeeds }  from "./rss";
import { hashUrl, hashTitle, slugify, deduplicateRaw } from "./dedup";
import { enhanceArticle } from "./ai-enhance";
import { scoreArticle }   from "./impact";
import { generateKenyaSummary } from "./kenya-transform";
import { NEWSAPI_QUERIES, GNEWS_QUERIES, RSS_FEEDS, SCOPE_COUNTRY } from "./sources";
import { query, isDbConfigured } from "@/lib/db";
import type { RawArticle, NewsScope, PipelineResult } from "./types";

async function isKnown(urlHash: string, titleHash: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM news_articles
       WHERE url_hash = $1 OR title_hash = $2
     ) AS exists`,
    [urlHash, titleHash],
  );
  return rows[0]?.exists ?? false;
}

async function insertArticle(
  raw: RawArticle,
  scope: NewsScope,
  country: string,
  useAi: boolean,
): Promise<boolean> {
  const urlHash   = hashUrl(raw.url);
  const titleHash = hashTitle(raw.title);

  if (await isKnown(urlHash, titleHash)) return false;

  const textContent = raw.content ?? raw.description ?? "";

  let summary  = raw.description?.slice(0, 500) ?? "";
  let tags: string[]    = [];
  let category = scope as string;

  if (useAi && textContent.length > 80) {
    try {
      const enhanced = await enhanceArticle(raw.title, textContent, scope);
      summary  = enhanced.summary  || summary;
      tags     = enhanced.tags;
      category = enhanced.category || category;
    } catch {
      // fall through — use description as summary
    }
  }

  const slug = slugify(raw.title, raw.publishedAt, urlHash);

  // Kenya Impact Layer (PR1). Deterministic score first — if it's "low" the
  // transform is skipped, saving the Haiku call. Both failure modes fall
  // through to NULL so the article still ingests cleanly.
  const impact = scoreArticle(raw.title, textContent);
  const kenyaSummary = useAi
    ? await generateKenyaSummary(raw.title, textContent, impact)
    : null;

  await query(
    `INSERT INTO news_articles
       (title, slug, source, source_url, country, category,
        content, summary, image, url, url_hash, title_hash,
        published_at, tags, status,
        impact_score, kenya_summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'published',
             $15, $16::jsonb)
     ON CONFLICT (url_hash) DO NOTHING`,
    [
      raw.title,
      slug,
      raw.source,
      raw.url,
      country,
      category,
      raw.content   ?? null,
      summary       || null,
      raw.image     ?? null,
      raw.url,
      urlHash,
      titleHash,
      raw.publishedAt,
      tags,
      impact.score,
      kenyaSummary ? JSON.stringify(kenyaSummary) : null,
    ],
  );
  return true;
}

export async function runPipeline(
  scope: NewsScope,
  options: { useAi?: boolean } = {},
): Promise<PipelineResult> {
  const t0 = Date.now();
  if (!isDbConfigured()) {
    return { scope, inserted: 0, skipped: 0, errors: 0, durationMs: 0 };
  }

  const country = SCOPE_COUNTRY[scope] ?? "global";
  const useAi   = options.useAi ?? Boolean(process.env.ANTHROPIC_API_KEY);
  const raw: RawArticle[] = [];

  // ── Fetch from all sources ──────────────────────────────────────────────────
  const newsapiQueries = NEWSAPI_QUERIES[scope] ?? [];
  const gnewsQueries   = GNEWS_QUERIES[scope]   ?? [];

  const [newsapiResults, gnewsResults] = await Promise.all([
    Promise.all(newsapiQueries.map((q) => fetchNewsAPI(q, 15))),
    Promise.all(gnewsQueries.map((q)   => fetchGNews(q, 8))),
  ]);

  for (const batch of newsapiResults) raw.push(...batch);
  for (const batch of gnewsResults)   raw.push(...batch);

  // RSS only for global scope (they cover all topics)
  if (scope === "global") {
    const rssArticles = await fetchRssFeeds(RSS_FEEDS);
    raw.push(...rssArticles);
  }

  // ── Deduplicate within this batch ──────────────────────────────────────────
  const unique = deduplicateRaw(raw);

  // ── Insert with DB dedup check ─────────────────────────────────────────────
  let inserted = 0, skipped = 0, errors = 0;

  // Process in serial to avoid hammering the AI API
  for (const article of unique) {
    try {
      const ok = await insertArticle(article, scope, country, useAi);
      if (ok) inserted++; else skipped++;
    } catch {
      errors++;
    }
  }

  return { scope, inserted, skipped, errors, durationMs: Date.now() - t0 };
}
