// Agnora Motors — Service Worker
// Strategy: network-first for pages/API, cache-first for static assets.

const CACHE_NAME = "agnora-v1";

// Pages to pre-cache on install for offline support
const PRECACHE_URLS = ["/", "/cars", "/sell", "/research", "/login", "/offline"];

// ── Install ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Use individual try/catches so one broken URL doesn't fail the whole install
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null)))
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache NextAuth, API routes, or Next.js internals
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.includes("__nextjs")
  ) {
    return;
  }

  // Static assets (images, fonts, icons) → cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // HTML pages → network-first, fall back to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            caches.match("/offline").then(
              (offline) =>
                offline ||
                new Response("<h1>You are offline</h1>", {
                  headers: { "Content-Type": "text/html" },
                  status: 503,
                })
            )
        )
      )
  );
});
