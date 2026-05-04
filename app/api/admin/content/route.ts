import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getNewsArticles, updateNewsArticleStatus, toggleNewsArticleFeatured,
  deleteNewsArticle, getResearchArticles, updateResearchArticle,
  deleteResearchArticle, isDbConfigured,
} from "@/lib/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "admin") return null;
  return session;
}

export async function GET(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ news: [], research: [] });
  }

  const { searchParams } = new URL(req.url);
  const tab    = searchParams.get("tab") ?? "news";
  const status = searchParams.get("status") ?? undefined;
  const limit  = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const offset = Number(searchParams.get("offset") ?? 0);

  if (tab === "research") {
    const articles = await getResearchArticles({ status, limit, offset }).catch(() => []);
    return NextResponse.json({ articles });
  }

  const articles = await getNewsArticles({ status, limit, offset }).catch(() => []);
  return NextResponse.json({ articles });
}

export async function PATCH(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    type: "news" | "research";
    id: string;
    action: "status" | "featured" | "delete";
    value?: string | boolean;
  };

  if (!isDbConfigured()) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  const { type, id, action, value } = body;

  if (type === "news") {
    if (action === "status") {
      await updateNewsArticleStatus(id, value as "published" | "pending" | "rejected");
    } else if (action === "featured") {
      await toggleNewsArticleFeatured(id, Boolean(value));
    } else if (action === "delete") {
      await deleteNewsArticle(id);
    }
  } else if (type === "research") {
    if (action === "status") {
      await updateResearchArticle(id, { status: value as "draft" | "published" });
    } else if (action === "featured") {
      await updateResearchArticle(id, { featured: Boolean(value) });
    } else if (action === "delete") {
      await deleteResearchArticle(id);
    }
  }

  return NextResponse.json({ ok: true });
}
