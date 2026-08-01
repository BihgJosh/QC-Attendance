const CACHE = "qcu-unit-v6";
// Only pre-cache the root shell for offline fallback. HTML is served
// network-first (see fetch handler), so these are just offline backups.
const STATIC_URLS = ["/"];

// Install — pre-cache the app shell, activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(STATIC_URLS);
    })
  );
});

// Activate — clean up old caches, take control of open pages
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - API calls: network only (never cached)
//   - Navigations / HTML documents: network-first (always get the latest
//     deploy; fall back to cache only when offline)
//   - Static build assets (hashed JS/CSS, images): cache-first (safe because
//     their filenames change on every deploy, so they're never stale)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET; let the browser deal with the rest.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API calls — network only, no cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // HTML documents / navigations — network-first so a new deploy shows up
  // immediately without needing a hard refresh.
  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/member")) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.headers.get("Cache-Control")?.includes("no-store")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Everything else (hashed static assets, images) — cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request).then((response) => {
    if (response.ok && !response.headers.get("Cache-Control")?.includes("no-store")) {
      caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => caches.match(request)));
});
