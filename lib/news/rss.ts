import type { RawArticle } from "./types";
import type { RssFeedDef } from "./sources";

function extractTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(cdataRe) ?? xml.match(plainRe);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function parsePublishedAt(xml: string): string {
  const raw = extractTag(xml, "pubDate") || extractTag(xml, "dc:date") || extractTag(xml, "published");
  if (!raw) return new Date().toISOString();
  try {
    return new Date(raw).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function extractImage(xml: string): string | undefined {
  // Try media:content, then enclosure, then og:image in description
  const media = extractAttr(xml, "media:content", "url") || extractAttr(xml, "media:thumbnail", "url");
  if (media) return media;
  const enclosure = extractAttr(xml, "enclosure", "url");
  if (enclosure && /\.(jpg|jpeg|png|webp)/i.test(enclosure)) return enclosure;
  return undefined;
}

async function parseFeed(def: RssFeedDef): Promise<RawArticle[]> {
  try {
    const res = await fetch(def.url, {
      headers: { "User-Agent": "Agnora-Motors-Bot/1.0 (+https://agnora-motors.com)" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const articles: RawArticle[] = [];

    // Match both <item> (RSS) and <entry> (Atom) elements
    const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
    let match;

    while ((match = itemRe.exec(xml)) !== null) {
      const item = match[1];
      const title = decodeEntities(stripHtml(extractTag(item, "title")));
      const link  = extractTag(item, "link") || extractAttr(item, "link", "href");
      if (!title || !link) continue;

      const description = decodeEntities(stripHtml(
        extractTag(item, "description") || extractTag(item, "summary") || extractTag(item, "content:encoded"),
      ));

      articles.push({
        title,
        url:         link.trim(),
        source:      def.source,
        description: description || undefined,
        image:       extractImage(item),
        publishedAt: parsePublishedAt(item),
      });

      if (articles.length >= 20) break;
    }

    return articles;
  } catch {
    return [];
  }
}

export async function fetchRssFeeds(feeds: RssFeedDef[]): Promise<RawArticle[]> {
  const results = await Promise.allSettled(feeds.map((f) => parseFeed(f)));
  return results
    .filter((r): r is PromiseFulfilledResult<RawArticle[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
