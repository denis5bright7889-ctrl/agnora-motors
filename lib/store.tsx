"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Wishlist ─────────────────────────────────────────────────

const WISHLIST_KEY = "agnora_wishlist";

interface WishlistCtx {
  ids: Set<string>;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  count: number;
}

const WishlistContext = createContext<WishlistCtx>({
  ids: new Set(),
  toggle: () => {},
  has: () => false,
  count: 0,
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(WISHLIST_KEY) ?? "[]",
      ) as string[];
      setIds(new Set(stored));
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return (
    <WishlistContext.Provider value={{ ids, toggle, has, count: ids.size }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}

// ── Recently viewed ───────────────────────────────────────────

const RECENT_KEY = "agnora_recently_viewed";

export function trackRecentlyViewed(id: string) {
  try {
    const stored = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]",
    ) as string[];
    const updated = [id, ...stored.filter((x) => x !== id)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function getRecentlyViewedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
