import Link from "next/link";
import { ShieldCheck, Star, Award, ArrowRight, MapPin } from "lucide-react";
import { isDbConfigured } from "@/lib/db";
import { getTopTrustedDealers } from "@/lib/reputation";

// Homepage "Top Trusted Dealers". Renders nothing until dealers actually clear
// the trust bar (verified + score ≥ 80 + ≥ 3 reviews) — no empty placeholder.
export async function TrustedDealersSection() {
  if (!isDbConfigured()) return null;
  const dealers = await getTopTrustedDealers(6).catch(() => []);
  if (dealers.length === 0) return null;

  return (
    <section className="py-14 lg:py-20 bg-surface border-t border-border">
      <div className="container max-w-container">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent mb-3">
              <Award className="h-3.5 w-3.5" /> Trusted Dealer Network
            </span>
            <h2 className="font-display text-3xl font-medium">Top trusted dealers</h2>
            <p className="text-muted text-sm mt-1">Verified dealers with proven track records and great reviews.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dealers.map((d) => (
            <Link
              key={d.slug}
              href={`/dealers/${d.slug}`}
              className="rounded-2xl border border-border bg-background p-5 hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-accent/15 flex items-center justify-center text-accent font-bold text-lg shrink-0">
                  {d.businessName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{d.businessName}</p>
                  <p className="text-xs text-muted flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.location}</p>
                </div>
                <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-bold text-accent shrink-0">{d.score}</span>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs">
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
                {d.rating !== null && (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {d.rating.toFixed(1)} ({d.reviewCount})
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-accent font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
