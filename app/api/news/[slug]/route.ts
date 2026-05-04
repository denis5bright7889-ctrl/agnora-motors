import { NextResponse } from "next/server";
import { getNewsArticleBySlug, incrementNewsViewCount, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const article = await getNewsArticleBySlug(slug).catch(() => null);
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fire-and-forget view increment
  incrementNewsViewCount(article.id).catch(() => {});

  return NextResponse.json({ article });
}
