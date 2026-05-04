import { Suspense } from "react";
import { auth } from "@/auth";
import { articles } from "@/data/content";
import { Globe, Newspaper, BookOpen, ArrowRight, Wrench, CreditCard, GitCompare, Star } from "lucide-react";
import { ResearchTabs } from "@/components/research/research-tabs";
import Link from "next/link";

export const metadata = {
  title: "Research — Agnora Motors",
  description: "Car news, community feed, reviews, and buying guides for Kenya's automotive market.",
};

const RESEARCH_CATEGORIES = [
  { label: "Car Reviews",       href: "/research?category=review",       icon: Star,        desc: "In-depth reviews for the Kenyan market" },
  { label: "Buying Guides",     href: "/research?category=buying-guide", icon: BookOpen,    desc: "Best cars by budget, use case, and road" },
  { label: "Comparisons",       href: "/research?category=comparison",   icon: GitCompare,  desc: "Head-to-head matchups for top imports" },
  { label: "Maintenance",       href: "/research?category=maintenance",  icon: Wrench,      desc: "Keeping imported cars in top condition" },
  { label: "Financing",         href: "/research?category=financing",    icon: CreditCard,  desc: "HP, bank loans, and leasing explained" },
];

export default async function ResearchPage() {
  const session = await auth();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border bg-surface/50 py-14 px-4">
        <div className="container max-w-container">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">Research</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-3 max-w-2xl">
            Car news, reviews &amp; community
          </h1>
          <p className="text-muted text-lg max-w-xl">
            Global automotive news, Kenyan market insights, buying guides, and a live community feed.
          </p>
        </div>
      </section>

      {/* Research category quick-links */}
      <section className="border-b border-border bg-background px-4 py-8">
        <div className="container max-w-container">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Browse by topic</h2>
            <Link
              href="/news"
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition-opacity"
            >
              <Newspaper className="h-3.5 w-3.5" />
              All news <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {RESEARCH_CATEGORIES.map(({ label, href, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-border bg-surface p-4 hover:border-accent/40 transition-colors flex flex-col gap-2"
              >
                <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <p className="font-semibold text-sm group-hover:text-accent transition-colors">{label}</p>
                <p className="text-xs text-muted line-clamp-2 hidden sm:block">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <Suspense fallback={<div className="h-12 border-b border-border" />}>
        <ResearchTabs
          articles={articles}
          userId={session?.user?.id}
          userName={session?.user?.name ?? undefined}
          userImage={session?.user?.image ?? undefined}
        />
      </Suspense>
    </div>
  );
}
