import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck, Star, ThumbsUp, Clock, MessageCircle, Car as CarIcon,
  MapPin, Award, BadgeCheck, CalendarDays,
} from "lucide-react";
import {
  getDealerProfileBySlug, getDealerCars, isDbConfigured,
} from "@/lib/db";
import { getDealerReputation } from "@/lib/reputation";
import { getDealerReviews } from "@/lib/trust";
import { ProfileViewTracker } from "@/components/dealers/profile-view-tracker";
import { formatPrice, cn } from "@/lib/utils";

export default async function DealerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDbConfigured()) notFound();

  const dealer = await getDealerProfileBySlug(slug).catch(() => null);
  // Only approved dealers get a public profile.
  if (!dealer || dealer.status !== "approved") notFound();

  const [rep, reviews, cars] = await Promise.all([
    getDealerReputation(dealer.id),
    getDealerReviews(dealer.id, 10),
    getDealerCars(dealer.id),
  ]);
  const listings = cars.filter((c) => c.status === "active");
  const { metrics: m } = rep;

  const memberSince = new Date(dealer.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" });

  return (
    <div className="min-h-screen">
      <ProfileViewTracker slug={slug} dealerId={dealer.id} />

      {/* Header */}
      <section className="border-b border-border bg-surface/50">
        <div className="container max-w-container py-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-accent/15 flex items-center justify-center text-accent font-bold text-2xl shrink-0">
              {dealer.businessName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-3xl font-medium">{dealer.businessName}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Dealer
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted mt-1.5">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {dealer.location}</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Member since {memberSince}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-container py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-8 order-2 lg:order-1">
          {/* Badges */}
          {rep.badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rep.badges.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
                  <Award className="h-3.5 w-3.5" /> {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Trust timeline */}
          <section>
            <h2 className="font-semibold mb-3">Trust timeline</h2>
            <ol className="relative border-l border-border ml-1.5 space-y-4">
              {[
                { label: `Joined Agnora`, date: memberSince },
                { label: "Verified business", date: null },
                ...(m.reviewCount > 0 ? [{ label: `${m.reviewCount} review${m.reviewCount === 1 ? "" : "s"} collected`, date: null }] : []),
                ...(m.totalLeads > 0 ? [{ label: `${m.totalLeads} enquir${m.totalLeads === 1 ? "y" : "ies"} handled`, date: null }] : []),
              ].map((item) => (
                <li key={item.label} className="ml-4">
                  <span className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-accent" />
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.date && <p className="text-xs text-muted">{item.date}</p>}
                </li>
              ))}
            </ol>
          </section>

          {/* Reviews */}
          <section>
            <h2 className="font-semibold mb-3">Reviews {m.reviewCount > 0 && <span className="text-muted font-normal">({m.reviewCount})</span>}</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.authorName}</span>
                        {r.purchaseVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-green-600 dark:text-green-400">
                            <BadgeCheck className="h-2.5 w-2.5" /> Verified
                          </span>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn("h-3.5 w-3.5", n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-border")} />
                        ))}
                      </div>
                    </div>
                    {r.body && <p className="text-sm text-muted mt-2">{r.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Listings */}
          <section>
            <h2 className="font-semibold mb-3">Listings {listings.length > 0 && <span className="text-muted font-normal">({listings.length})</span>}</h2>
            {listings.length === 0 ? (
              <p className="text-sm text-muted">No active listings right now.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {listings.map((c) => (
                  <Link key={c.id} href={`/cars/${c.slug}`} className="rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors">
                    <div className="aspect-[4/3] bg-surface-2 relative">
                      {c.images?.[0] ? (
                        <Image src={c.images[0]} alt={`${c.make} ${c.model}`} fill sizes="200px" className="object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><CarIcon className="h-8 w-8 text-muted/30" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{c.year} {c.make} {c.model}</p>
                      <p className="text-accent font-semibold text-sm">KSh {formatPrice(c.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Reputation sidebar */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 h-fit space-y-4">
          <div className="rounded-3xl border border-border bg-surface p-6 text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Dealer Score</p>
            <p className="font-display text-5xl font-semibold text-accent">{rep.score}</p>
            <p className="text-sm font-medium mt-1">{rep.band}</p>
            {rep.reviewConfidence < 0.4 && m.reviewCount > 0 && (
              <p className="text-[11px] text-muted mt-2">Building confidence — based on {m.reviewCount} review{m.reviewCount === 1 ? "" : "s"} so far</p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-surface p-5 space-y-3">
            <Stat icon={Star} label="Rating" value={m.reviewCount > 0 ? `${m.reviewAverage.toFixed(1)} ★` : "No reviews yet"} />
            {m.recommendPct !== null && <Stat icon={ThumbsUp} label="Would recommend" value={`${Math.round(m.recommendPct)}%`} />}
            <Stat icon={Clock} label="Responds in" value={m.avgResponseHours !== null ? fmtHours(m.avgResponseHours) : "—"} />
            <Stat icon={MessageCircle} label="Enquiries handled" value={m.totalLeads} />
            <Stat icon={CarIcon} label="Vehicles listed" value={listings.length} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(0)} hrs`;
  return `${Math.round(h / 24)} days`;
}
