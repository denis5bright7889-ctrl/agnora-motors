"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function ProfileViewTracker({ slug, dealerId }: { slug: string; dealerId: string }) {
  useEffect(() => {
    trackEvent("dealer_profile_view", { slug, dealerId });
  }, [slug, dealerId]);
  return null;
}
