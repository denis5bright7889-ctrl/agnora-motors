import { createHash } from "crypto";

export function hashUrl(url: string): string {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex").slice(0, 20);
}

export function hashTitle(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 20);
}

export function slugify(title: string, date: string, urlHash: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70)
    .replace(/-$/, "");
  const d = new Date(date);
  const dateStr = isNaN(d.getTime()) ? "2025-01-01" : d.toISOString().slice(0, 10);
  // Include 6-char hash suffix to guarantee uniqueness across same-title/same-day articles
  return `${base}-${dateStr}-${urlHash.slice(0, 6)}`;
}

export function researchSlugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
    .replace(/-$/, "");
}

// Simple Levenshtein distance — used for exact-near-duplicate detection on titles
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[n];
}

export function areTitlesSimilar(a: string, b: string, threshold = 0.88): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(na, nb);
  return (1 - dist / maxLen) >= threshold;
}

export function deduplicateRaw<T extends { url: string; title: string }>(items: T[]): T[] {
  const seenUrls = new Set<string>();
  const seenTitleHashes = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const u = item.url.trim();
    const th = hashTitle(item.title);
    if (seenUrls.has(u) || seenTitleHashes.has(th)) continue;
    seenUrls.add(u);
    seenTitleHashes.add(th);
    result.push(item);
  }
  return result;
}
