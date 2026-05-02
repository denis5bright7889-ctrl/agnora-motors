import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, ArrowLeft, BookOpen } from "lucide-react";
import { getArticleBySlug, articles } from "@/data/content";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: `${article.title} — Agnora Research`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = articles.filter(
    (a) => a.slug !== slug && a.category === article.category
  ).slice(0, 3);

  const categoryColors: Record<string, string> = {
    Review: "bg-blue-500/15 text-blue-500",
    News: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    "Buying Guide": "bg-accent-soft text-accent",
    Ownership: "bg-purple-500/15 text-purple-500",
  };

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-surface/50">
        <div className="container max-w-container py-3 flex items-center gap-2 text-sm text-muted">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/research" className="hover:text-foreground transition-colors">Research</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground truncate">{article.title}</span>
        </div>
      </div>

      <div className="container max-w-container py-12 px-4">
        <div className="grid lg:grid-cols-[1fr_300px] gap-12">
          {/* Article */}
          <article>
            <Link
              href="/research"
              className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Research
            </Link>

            {/* Category & meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[article.category] ?? "bg-surface-2 text-muted"}`}>
                {article.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock className="h-3 w-3" /> {article.readTime} min read
              </span>
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-medium leading-tight mb-4">
              {article.title}
            </h1>

            <p className="text-muted mb-6">{article.excerpt}</p>

            <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
              <div className="h-9 w-9 rounded-full bg-accent-soft flex items-center justify-center text-accent font-bold text-sm">
                {article.author[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{article.author}</p>
                <p className="text-xs text-muted">{formatDate(article.publishedAt)}</p>
              </div>
            </div>

            {/* Cover image */}
            <div className="rounded-3xl overflow-hidden aspect-[16/9] mb-8">
              <img
                src={article.cover}
                alt={article.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Body */}
            <div className="prose prose-sm max-w-none text-muted leading-relaxed space-y-4">
              {article.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {/* Filler content so single-paragraph articles look complete */}
              <p>
                The Kenyan market continues to evolve rapidly, with buyers becoming increasingly
                sophisticated in their research and decision-making. Price transparency, fuel
                economy, and total cost of ownership are now primary considerations rather than
                just purchase price. Dealers who understand this shift are adapting their
                inventory and messaging accordingly.
              </p>
              <p>
                If you're considering a purchase in this category, our advice is to look at
                three-year running costs alongside the sticker price. Factor in insurance,
                service intervals, parts availability, and fuel economy on Kenyan roads — which
                often means more stop-start city driving than the official cycle assumes.
              </p>
              <p>
                We'll continue tracking developments in this space. Follow Agnora Research for
                updates as the market shifts, or browse our listings to see what's currently
                available at transparent prices.
              </p>
            </div>

            {/* Tags */}
            <div className="mt-8 pt-8 border-t border-border flex flex-wrap gap-2">
              {[article.category, article.author, "Kenya"].map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
            {/* More articles */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">More {article.category}</h2>
              </div>
              <div className="space-y-4">
                {(related.length ? related : articles.filter((a) => a.slug !== slug).slice(0, 3)).map((a) => (
                  <Link
                    key={a.slug}
                    href={`/research/${a.slug}`}
                    className="group flex gap-3 items-start"
                  >
                    <div className="h-14 w-20 shrink-0 rounded-xl overflow-hidden">
                      <img
                        src={a.cover}
                        alt={a.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted mt-1">{a.readTime} min · {formatDate(a.publishedAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-accent-soft/40 border border-accent/20 p-5">
              <p className="text-sm font-semibold mb-1">Ready to buy?</p>
              <p className="text-xs text-muted mb-3">Browse thousands of verified listings from trusted dealers across Kenya.</p>
              <Link
                href="/cars"
                className="block text-center h-9 leading-9 rounded-full bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Browse listings
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
