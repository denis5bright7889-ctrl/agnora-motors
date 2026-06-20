import { NextResponse } from "next/server";
import { getNewsArticleBySlug, incrementNewsViewCount, isDbConfigured } from "@/lib/db";
import { getStaticNewsBySlug } from "@/lib/news/static-news";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Prefer the DB; fall back to the static article set so that cards rendered
  // from the static list (/api/news) always resolve instead of 404-ing.
  if (isDbConfigured()) {
    const article = await getNewsArticleBySlug(slug).catch(() => null);
    if (article) {
      incrementNewsViewCount(article.id).catch(() => {}); // fire-and-forget
      return NextResponse.json({ article });
    }
  }

  const staticArticle = getStaticNewsBySlug(slug);
  if (staticArticle) {
    return NextResponse.json({ article: staticArticle });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
