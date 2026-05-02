import { Suspense } from "react";
import { auth } from "@/auth";
import { articles } from "@/data/content";
import { Globe } from "lucide-react";
import { ResearchTabs } from "@/components/research/research-tabs";

export const metadata = {
  title: "Research — Agnora Motors",
  description: "Car news, community feed, reviews, and buying guides for Kenya's automotive market.",
};

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
            Global automotive news, Kenyan market insights, and a live community feed — all in one place.
          </p>
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
