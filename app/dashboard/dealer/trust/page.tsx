import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Star, ShieldAlert, ThumbsUp, BadgeCheck } from "lucide-react";
import { getDealerByUserId, isDbConfigured } from "@/lib/db";
import {
  getDealerReviews, getDealerReviewSummary,
  getDealerComplaints, getDealerComplaintStats,
  type Review, type ReviewSummary, type Complaint, type ComplaintStats,
} from "@/lib/trust";
import { ComplaintsPanel } from "@/components/dashboard/complaints-panel";
import { cn } from "@/lib/utils";

export const metadata = { title: "Trust & Reputation — Dealer Control Center" };

export default async function DealerTrustPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "private_seller") redirect("/dashboard/seller");
  if (session.user.role !== "dealer" && session.user.role !== "admin") redirect("/");

  let summary: ReviewSummary | null = null;
  let reviews: Review[] = [];
  let complaints: Complaint[] = [];
  let stats: ComplaintStats | null = null;

  if (isDbConfigured() && session.user.role === "dealer") {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    [summary, reviews, complaints, stats] = await Promise.all([
      getDealerReviewSummary(dealer.id),
      getDealerReviews(dealer.id),
      getDealerComplaints(dealer.id),
      getDealerComplaintStats(dealer.id),
    ]);
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Trust & Reputation</h1>
        <p className="text-muted mt-0.5 text-sm">Reviews and complaints — the signals buyers use to trust you</p>
      </div>

      {/* ── Reviews ── */}
      <section className="space-y-4">
        <h2 className="font-semibold">Customer reviews</h2>
        {!summary || summary.count === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Star className="h-9 w-9 text-muted/40 mx-auto mb-3" />
            <p className="font-medium mb-1">No reviews yet</p>
            <p className="text-sm text-muted max-w-sm mx-auto">
              Buyers can rate you from your listings. Fast replies and accurate listings earn the best reviews.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat icon={Star} label="Average rating" value={summary.average.toFixed(1)} sub={`${summary.count} review${summary.count === 1 ? "" : "s"}`} accent />
              <Stat icon={ThumbsUp} label="Would recommend" value={summary.recommendPct !== null ? `${Math.round(summary.recommendPct)}%` : "—"} />
              <Stat icon={BadgeCheck} label="Verified purchases" value={summary.verifiedCount} />
              <Stat icon={Star} label="Communication" value={summary.communication !== null ? summary.communication.toFixed(1) : "—"} />
            </div>

            <div className="space-y-3">
              {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          </>
        )}
      </section>

      {/* ── Complaints ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Complaints</h2>
          {stats && stats.total > 0 && (
            <span className="text-xs text-muted">
              {stats.open} open · {stats.resolved} resolved
              {stats.avgResolutionHours !== null && ` · ~${fmtHours(stats.avgResolutionHours)} avg`}
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <ComplaintsPanel initial={complaints} />
        </div>
        <p className="text-xs text-muted flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          Responding promptly and resolving issues protects your reputation. Final outcomes are reviewed by Agnora.
        </p>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className={cn("mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl", accent ? "bg-accent-soft" : "bg-surface-2")}>
        <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-xl font-semibold font-display">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{review.authorName}</span>
          {review.purchaseVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-green-600 dark:text-green-400">
              <BadgeCheck className="h-2.5 w-2.5" /> Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("h-3.5 w-3.5", n <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-border")} />
          ))}
        </div>
      </div>
      {review.body && <p className="text-sm text-muted mt-2">{review.body}</p>}
      {review.wouldRecommend !== null && (
        <p className="text-xs text-muted mt-2 flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" /> {review.wouldRecommend ? "Would recommend" : "Would not recommend"}
        </p>
      )}
    </div>
  );
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(0)}h`;
  return `${Math.round(h / 24)}d`;
}
