/* Scoobix service worker — static asset caching + offline shell.
 *
 * Strategy:
 *  - precache the app shell so a cold start is instant and works offline
 *  - cache-first with background revalidate for hashed build assets, fonts and images
 *  - network-first for navigations, falling back to the cached shell offline
 *  - never cache API traffic (InsForge / AI) — data freshness stays with the app
 */
const VERSION = "sx-v3";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  /\.(?:js|css|woff2?|ttf|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname) ||
  url.pathname.startsWith("/_build/") ||
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/__l5e/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith("insforge.app")) return;

  // Cache-first + background revalidate for immutable-ish static assets.
  if (isStaticAsset(url) || url.hostname.includes("fonts.g")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) {
          event.waitUntil(
            fetch(req)
              .then((res) => (res && res.ok ? cache.put(req, res.clone()) : undefined))
              .catch(() => undefined),
          );
          return hit;
        }
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      }),
    );
    return;
  }

  // Navigations: network-first with an offline fallback to the cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => undefined));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || new Response("Offline", { status: 503 })),
    );
  }
});

// Warm the cache with resources the app knows it will need next.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "prefetch" && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(STATIC).then((cache) =>
        Promise.all(
          data.urls.map((u) =>
            fetch(u, { credentials: "same-origin" })
              .then((res) => (res && res.ok ? cache.put(u, res.clone()) : undefined))
              .catch(() => undefined),
          ),
        ),
      ),
    );
  }
});
