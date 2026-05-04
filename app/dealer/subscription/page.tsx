import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Check, Zap, Star, Crown, ArrowRight } from "lucide-react";
import { getSubscription, isDbConfigured } from "@/lib/db";
import { PLANS, getPlan, PRIVATE_SELLER_LIMITS } from "@/lib/subscriptions";
import { cn, formatPrice } from "@/lib/utils";
import Link from "next/link";

const PLAN_ICONS = {
  free:    Zap,
  pro:     Star,
  premium: Crown,
} as const;

const DEALER_FEATURES = [
  { label: "Listings",           free: "3",             pro: "25",            premium: "Unlimited" },
  { label: "Featured slots",     free: "—",             pro: "3",             premium: "15" },
  { label: "Analytics",          free: "Basic",         pro: "Full (30-day)", premium: "Full (30-day)" },
  { label: "AI Chat assistant",  free: "—",             pro: "✓",             premium: "✓" },
  { label: "Visibility boost",   free: "—",             pro: "✓",             premium: "✓" },
  { label: "Priority support",   free: "—",             pro: "—",             premium: "✓" },
];

const SELLER_FEATURES = [
  { label: "Listings",           free: "1",             pro: "5",             premium: "15" },
  { label: "Analytics",          free: "Basic",         pro: "Full",          premium: "Full" },
  { label: "AI Chat assistant",  free: "—",             pro: "✓",             premium: "✓" },
  { label: "Visibility boost",   free: "—",             pro: "✓",             premium: "✓" },
];

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  let planId = "free";

  if (isDbConfigured()) {
    try {
      const sub = await getSubscription(session.user.id);
      planId = sub?.plan ?? "free";
    } catch {
      // fall through
    }
  }

  const currentPlan = getPlan(planId);
  const isPrivateSeller = role === "private_seller";
  const features = isPrivateSeller ? SELLER_FEATURES : DEALER_FEATURES;

  return (
    <div className="space-y-10 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium">Subscription</h1>
        <p className="text-muted mt-1 text-sm">
          Current plan: <span className="font-semibold text-foreground capitalize">{currentPlan.name}</span>
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["free", "pro", "premium"] as const).map((id) => {
          const plan   = PLANS[id];
          const Icon   = PLAN_ICONS[id];
          const active = planId === id;
          const maxL   = isPrivateSeller
            ? PRIVATE_SELLER_LIMITS[id].maxListings
            : plan.maxListings;

          return (
            <div
              key={id}
              className={cn(
                "relative rounded-3xl border p-6 flex flex-col gap-4 transition-shadow",
                active
                  ? "border-accent bg-accent/5 shadow-lg shadow-accent/10"
                  : "border-border bg-surface hover:border-accent/40",
                id === "pro" && !active && "md:scale-[1.02]",
              )}
            >
              {/* Badge */}
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold text-white">
                  {plan.badge}
                </span>
              )}
              {active && (
                <span className="absolute -top-3 right-5 inline-flex items-center rounded-full bg-green-500 px-3 py-0.5 text-[10px] font-bold text-white">
                  Current
                </span>
              )}

              {/* Plan name */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center",
                  id === "free"    && "bg-surface-2",
                  id === "pro"     && "bg-blue-500/10",
                  id === "premium" && "bg-accent-soft",
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    id === "free"    && "text-muted",
                    id === "pro"     && "text-blue-500",
                    id === "premium" && "text-accent",
                  )} />
                </div>
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted">{plan.description}</p>
                </div>
              </div>

              {/* Price */}
              <div>
                {plan.price === 0 ? (
                  <p className="text-3xl font-display font-semibold">Free</p>
                ) : (
                  <p className="text-3xl font-display font-semibold">
                    KSh {formatPrice(plan.price)}
                    <span className="text-sm font-normal text-muted">/mo</span>
                  </p>
                )}
              </div>

              {/* Key features */}
              <ul className="space-y-2 flex-1">
                <Feature text={`${maxL === -1 ? "Unlimited" : maxL} listing${maxL === 1 ? "" : "s"}`} />
                {id !== "free" && <Feature text={`${plan.maxFeatured} featured slot${plan.maxFeatured !== 1 ? "s" : ""}`} />}
                {plan.analytics === "full" && <Feature text="Full 30-day analytics" />}
                {plan.aiChat && <Feature text="AI chat assistant" />}
                {plan.boost && <Feature text="Visibility boost" />}
                {plan.prioritySupport && <Feature text="Priority support" />}
              </ul>

              {/* CTA */}
              {active ? (
                <div className="mt-auto h-11 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-semibold flex items-center justify-center">
                  Active plan
                </div>
              ) : id === "free" ? (
                <p className="mt-auto text-center text-xs text-muted">Downgrade not available</p>
              ) : planId === "premium" && id === "pro" ? (
                <p className="mt-auto text-center text-xs text-muted">You&apos;re on a higher plan</p>
              ) : (
                <UpgradeCTA planId={id} planName={plan.name} price={plan.price} />
              )}
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div>
        <h2 className="font-semibold mb-4">Full feature comparison</h2>
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Feature</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted">Free</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-blue-500">Pro</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-accent">Premium</th>
              </tr>
            </thead>
            <tbody>
              {features.map(({ label, free, pro, premium }) => (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{label}</td>
                  <td className="px-4 py-3 text-center font-medium">{free}</td>
                  <td className="px-4 py-3 text-center font-medium text-blue-500">{pro}</td>
                  <td className="px-4 py-3 text-center font-medium text-accent">{premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment note */}
      <p className="text-xs text-muted text-center">
        Payment processed via M-Pesa or card. Contact{" "}
        <a href="mailto:support@agnora-motors.com" className="underline hover:text-foreground">
          support@agnora-motors.com
        </a>{" "}
        to upgrade your plan.
      </p>

    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
      {text}
    </li>
  );
}

function UpgradeCTA({ planId, planName, price }: { planId: string; planName: string; price: number }) {
  return (
    <a
      href={`mailto:support@agnora-motors.com?subject=Upgrade to ${planName} plan&body=Hi, I'd like to upgrade my Agnora account to the ${planName} plan (KSh ${formatPrice(price)}/mo). Please assist.`}
      className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
    >
      Upgrade to {planName} <ArrowRight className="h-4 w-4" />
    </a>
  );
}
