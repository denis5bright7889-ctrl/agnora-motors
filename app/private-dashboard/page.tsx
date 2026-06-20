import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  Car, Eye, MessageCircle, PlusCircle, ArrowRight,
  Zap, Star, Crown, Lock, Check, Home, LogOut,
  Settings, CreditCard, TrendingUp,
} from "lucide-react";
import {
  getPrivateSellerByUserId, getSellerCars, getSellerDailyViews,
  getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan, PLANS, PRIVATE_SELLER_LIMITS } from "@/lib/subscriptions";
import { formatPrice, cn } from "@/lib/utils";
import type { DealerCar } from "@/types";

// ── helpers ──────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className={cn(
        "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl",
        accent ? "bg-accent-soft" : "bg-surface-2",
      )}>
        <Icon className={cn("h-5 w-5", accent ? "text-accent" : "text-muted")} />
      </div>
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-sm font-medium mt-0.5 text-muted">{label}</p>
    </div>
  );
}

function FeatureRow({ label, free, pro, premium }: {
  label: string; free: string; pro: string; premium: string;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 text-sm text-muted pr-4">{label}</td>
      <td className="py-3 text-sm text-center font-medium">{free}</td>
      <td className="py-3 text-sm text-center font-medium text-blue-500">{pro}</td>
      <td className="py-3 text-sm text-center font-medium text-accent">{premium}</td>
    </tr>
  );
}

// ── page ─────────────────────────────────────────────────────

export default async function PrivateDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "private_seller" && role !== "admin") {
    redirect(role === "dealer" ? "/dealer-dashboard" : "/");
  }

  let cars: DealerCar[]                           = [];
  let dailyViewRows: { date: string; views: string }[] = [];
  let planId  = "free";
  let hasSeller = true;

  if (isDbConfigured()) {
    try {
      const seller = await getPrivateSellerByUserId(session.user.id);
      if (!seller) {
        hasSeller = false;
      } else {
        [cars, dailyViewRows] = await Promise.all([
          getSellerCars(session.user.id),
          getSellerDailyViews(session.user.id, 14),
        ]);
      }
      const sub = await getSubscription(session.user.id);
      planId = sub?.plan ?? "free";
    } catch {
      // fall through with empty state
    }
  }

  // Admins can view the private-seller dashboard in read-only mode even
  // without a seller record (no private_sellers row exists for them).
  if (!hasSeller && role !== "admin") redirect("/seller/register");

  const plan            = getPlan(planId);
  const car             = cars[0] ?? null;                        // private sellers show first car
  const totalViews      = cars.reduce((s, c) => s + (c.views ?? 0), 0);
  const totalInquiries  = cars.reduce((s, c) => s + (c.inquiries ?? 0), 0);
  const displayName     = session.user.name ?? "Private Seller";
  const maxListings     = PRIVATE_SELLER_LIMITS[planId as keyof typeof PRIVATE_SELLER_LIMITS]?.maxListings ?? 1;

  // build a simple 7-day sparkline
  const viewMap = new Map(dailyViewRows.map((r) => [r.date, Number(r.views)]));
  const last7: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last7.push(viewMap.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  const maxSpark = Math.max(...last7, 1);

  const PLAN_ICONS = { free: Zap, pro: Star, premium: Crown } as const;
  const PlanIcon = PLAN_ICONS[planId as keyof typeof PLAN_ICONS] ?? Zap;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="container max-w-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            Agnora<span className="text-accent">.</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              planId === "free"    && "bg-surface-2 text-muted",
              planId === "pro"     && "bg-blue-500/10 text-blue-500",
              planId === "premium" && "bg-accent-soft text-accent",
            )}>
              <PlanIcon className="h-3 w-3" />
              {plan.name} Plan
            </div>

            <Link
              href="/private-dashboard/settings"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2 text-muted transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <form action={async () => {
              "use server";
              const { signOut } = await import("@/auth");
              await signOut({ redirectTo: "/" });
            }}>
              <button
                type="submit"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2 text-muted transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
              <span className="text-accent font-bold text-sm">{displayName[0]?.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-container py-8 space-y-8">

        {/* ── Welcome ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium">
              Hi, {displayName.split(" ")[0]}
            </h1>
            <p className="text-muted mt-0.5 text-sm">
              Private seller · {plan.name} plan
              {planId === "free" && (
                <Link href="/private-dashboard/upgrade" className="ml-2 text-accent hover:underline font-semibold">
                  Upgrade
                </Link>
              )}
            </p>
          </div>

          {cars.length < maxListings && (
            <Link
              href="/dealer/listings/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              {cars.length === 0 ? "List your car" : "Add listing"}
            </Link>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard icon={Car} label="My listings" value={cars.length} />
          <StatCard icon={Eye} label="Total views" value={totalViews} accent />
          <StatCard icon={MessageCircle} label="Inquiries" value={totalInquiries} />
        </div>

        {/* ── My Car Listing ── */}
        <section>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted mb-3">My Listing</h2>
          {car ? (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Image */}
                <div className="sm:w-48 shrink-0 aspect-video sm:aspect-auto bg-surface-2 overflow-hidden">
                  {car.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={car.images[0]} alt={car.make} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Car className="h-10 w-10 text-muted/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold">{car.year} {car.make} {car.model}</h3>
                      <p className="text-accent font-semibold text-sm mt-0.5">{formatPrice(car.price)}</p>
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                      car.status === "active" ? "bg-green-500/15 text-green-600 dark:text-green-400"
                        : car.status === "sold" ? "bg-surface-2 text-muted"
                        : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
                    )}>
                      {car.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted mb-4">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {car.views ?? 0} views
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {car.inquiries ?? 0} inquiries
                    </span>
                    <span>{car.location}</span>
                  </div>

                  {/* 7-day sparkline */}
                  <div className="flex items-end gap-0.5 h-8 mb-4">
                    {last7.map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-accent transition-all"
                        style={{ height: `${Math.max(8, Math.round((v / maxSpark) * 100))}%` }}
                        title={`${v} views`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted mb-4">Views — last 7 days</p>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/cars/${car.slug}`}
                      className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-surface-2 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View listing
                    </Link>
                    <Link
                      href={`/dealer/listings`}
                      className="h-8 inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Manage listing <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 mb-4">
                <Car className="h-7 w-7 text-muted" />
              </div>
              <h3 className="font-semibold mb-1">No listing yet</h3>
              <p className="text-sm text-muted mb-5 max-w-xs mx-auto">
                List your car and reach thousands of buyers across Kenya.
              </p>
              <Link
                href="/dealer/listings/new"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <PlusCircle className="h-4 w-4" /> List my car
              </Link>
            </div>
          )}
        </section>

        {/* ── Views chart (if has car) ── */}
        {last7.some((v) => v > 0) && (
          <section>
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted mb-3">
              Activity — last 7 days
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="font-semibold text-sm">{totalViews} total views</span>
                <span className="text-xs text-muted">this week</span>
              </div>
              <div className="flex items-end gap-1 h-24">
                {last7.map((v, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (6 - i));
                  const label = d.toLocaleDateString("en-KE", { weekday: "short" });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-accent/80 transition-all"
                        style={{ height: `${Math.max(4, Math.round((v / maxSpark) * 88))}px` }}
                        title={`${v} views`}
                      />
                      <span className="text-[9px] text-muted">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Subscription & feature gates ── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Your Plan</h2>
            {planId === "free" && (
              <Link
                href="/dealer/subscription"
                className="text-xs font-semibold text-accent hover:underline"
              >
                View all plans →
              </Link>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(["free", "pro", "premium"] as const).map((pid) => {
              const p    = PLANS[pid];
              const Icon = PLAN_ICONS[pid];
              const isCurrent = planId === pid;
              const maxL = PRIVATE_SELLER_LIMITS[pid].maxListings;

              return (
                <div key={pid} className={cn(
                  "rounded-2xl border p-5 relative overflow-hidden",
                  isCurrent
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface",
                )}>
                  {isCurrent && (
                    <span className="absolute top-3 right-3 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                      Current
                    </span>
                  )}
                  <div className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl mb-3",
                    pid === "free"    && "bg-surface-2",
                    pid === "pro"     && "bg-blue-500/15",
                    pid === "premium" && "bg-accent/15",
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      pid === "free"    && "text-muted",
                      pid === "pro"     && "text-blue-500",
                      pid === "premium" && "text-accent",
                    )} />
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm font-bold mt-0.5 mb-3">
                    {p.price === 0 ? "Free" : `KSh ${p.price.toLocaleString()}/mo`}
                  </p>

                  <ul className="space-y-2 text-xs text-muted mb-4">
                    {[
                      `${maxL} listing${maxL > 1 ? "s" : ""}`,
                      pid !== "free" ? "Full analytics" : "Basic stats",
                      pid !== "free" ? "AI chat assistant" : null,
                      pid !== "free" ? "Visibility boost" : null,
                      pid === "premium" ? "Priority support" : null,
                    ].filter(Boolean).map((feat) => (
                      <li key={feat} className={cn(
                        "flex items-center gap-1.5",
                        !isCurrent && pid !== "free" && "opacity-60",
                      )}>
                        {isCurrent || pid === "free" ? (
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {!isCurrent && (
                    <Link
                      href="/dealer/subscription"
                      className={cn(
                        "flex w-full items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all",
                        pid === "pro"     && "bg-blue-500 text-white hover:opacity-90",
                        pid === "premium" && "bg-accent text-white hover:opacity-90",
                        pid === "free"    && "border border-border hover:bg-surface-2 text-muted",
                      )}
                    >
                      {pid === "free" ? "Downgrade" : "Upgrade"} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Quick links ── */}
        <section>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted mb-3">Quick links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/dealer/listings",     icon: Car,         label: "My listings" },
              { href: "/dealer/subscription", icon: CreditCard,  label: "Subscription" },
              { href: "/",                     icon: Home,        label: "Back to site" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm font-medium text-muted hover:border-accent/40 hover:text-foreground transition-all"
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
            <form action={async () => {
              "use server";
              const { signOut } = await import("@/auth");
              await signOut({ redirectTo: "/" });
            }}>
              <button
                type="submit"
                className="w-full flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm font-medium text-muted hover:border-red-500/30 hover:text-red-500 transition-all"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </form>
          </div>
        </section>

      </div>
    </div>
  );
}
