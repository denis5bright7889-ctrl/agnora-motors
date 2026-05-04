// ── Plan definitions ──────────────────────────────────────────────────────────

export type PlanId = "free" | "pro" | "premium";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // KSh/month
  badge?: string;
  description: string;
  maxListings: number; // -1 = unlimited
  maxFeatured: number;
  analytics: "basic" | "full";
  aiChat: boolean;
  boost: boolean;
  prioritySupport: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    description: "Get started with basic listings",
    maxListings: 3,
    maxFeatured: 0,
    analytics: "basic",
    aiChat: false,
    boost: false,
    prioritySupport: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 2_999,
    badge: "Popular",
    description: "For growing dealers and serious sellers",
    maxListings: 25,
    maxFeatured: 3,
    analytics: "full",
    aiChat: true,
    boost: true,
    prioritySupport: false,
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 5_999,
    badge: "Best value",
    description: "Unlimited power for high-volume dealers",
    maxListings: -1,
    maxFeatured: 15,
    analytics: "full",
    aiChat: true,
    boost: true,
    prioritySupport: true,
  },
};

// Private sellers get different limits regardless of plan
export const PRIVATE_SELLER_LIMITS: Record<PlanId, { maxListings: number }> = {
  free:    { maxListings: 1 },
  pro:     { maxListings: 5 },
  premium: { maxListings: 15 },
};

export function getPlan(id: string): Plan {
  return PLANS[(id as PlanId)] ?? PLANS.free;
}

export interface FeatureGate {
  allowed: boolean;
  reason?: string;
  requiredPlan?: PlanId;
}

export function canAddListing(
  plan: PlanId,
  currentCount: number,
  isPrivateSeller = false,
): FeatureGate {
  const limit = isPrivateSeller
    ? PRIVATE_SELLER_LIMITS[plan].maxListings
    : PLANS[plan].maxListings;

  if (limit === -1) return { allowed: true };
  if (currentCount < limit) return { allowed: true };

  const nextPlan: PlanId = plan === "free" ? "pro" : "premium";
  return {
    allowed: false,
    reason: `You've reached the ${limit}-listing limit on your ${PLANS[plan].name} plan.`,
    requiredPlan: nextPlan,
  };
}

export function canFeatureListing(plan: PlanId, featuredCount: number): FeatureGate {
  const limit = PLANS[plan].maxFeatured;
  if (limit === 0) {
    return {
      allowed: false,
      reason: "Featured listings are not available on the Free plan.",
      requiredPlan: "pro",
    };
  }
  if (featuredCount >= limit) {
    return {
      allowed: false,
      reason: `You've used all ${limit} featured slots on your ${PLANS[plan].name} plan.`,
      requiredPlan: plan === "pro" ? "premium" : undefined,
    };
  }
  return { allowed: true };
}

export function canUseAiChat(plan: PlanId): FeatureGate {
  if (PLANS[plan].aiChat) return { allowed: true };
  return {
    allowed: false,
    reason: "AI chat is available on Pro and Premium plans.",
    requiredPlan: "pro",
  };
}

export function canBoost(plan: PlanId): FeatureGate {
  if (PLANS[plan].boost) return { allowed: true };
  return {
    allowed: false,
    reason: "Visibility boost is available on Pro and Premium plans.",
    requiredPlan: "pro",
  };
}

export function hasFullAnalytics(plan: PlanId): boolean {
  return PLANS[plan].analytics === "full";
}
