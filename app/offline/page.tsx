"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";

// Served by the service worker (public/sw.js) when a navigation request fails
// and nothing matching is cached. Kept lightweight so it renders without a
// network round-trip.
export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
        <WifiOff className="h-8 w-8 text-muted" />
      </div>

      <h1 className="mt-6 font-display text-2xl font-medium">You're offline</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        We can't reach Agnora Motors right now. Check your connection and try
        again — pages you've already visited may still be available.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-6 text-sm font-medium text-muted transition-colors hover:text-foreground hover:border-accent/40"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
