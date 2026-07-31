/**
 * Service worker registration + resource prefetching.
 *
 * Registration is deferred until after first paint so it never competes with
 * the initial render. Prefetching asks the worker to warm the cache for the
 * routes a user hits next (home → restaurant → cart → checkout).
 */

const READY_STATE = { registered: false };

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || READY_STATE.registered) return;
  READY_STATE.registered = true;
  const start = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      READY_STATE.registered = false;
    });
  };
  if (document.readyState === "complete") setTimeout(start, 800);
  else window.addEventListener("load", () => setTimeout(start, 800), { once: true });
}

/** Ask the worker to cache these URLs in the background. */
export function prefetchResources(urls: string[]) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !urls.length) return;
  void navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: "prefetch", urls }))
    .catch(() => undefined);
}

/** Drop every Scoobix cache (used by the admin performance dashboard). */
export async function clearAssetCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("sx-")).map((k) => caches.delete(k)));
}

export async function assetCacheStats() {
  if (typeof caches === "undefined") return { caches: 0, entries: 0 };
  const keys = (await caches.keys()).filter((k) => k.startsWith("sx-"));
  let entries = 0;
  for (const k of keys) {
    const c = await caches.open(k);
    entries += (await c.keys()).length;
  }
  return { caches: keys.length, entries };
}

/** Storage quota usage, when the browser exposes it. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  const nav = navigator as Navigator & { storage?: { estimate?: () => Promise<StorageEstimate> } };
  if (!nav.storage?.estimate) return null;
  try {
    const est = await nav.storage.estimate();
    return {
      usedMb: Math.round((est.usage ?? 0) / 1048576),
      quotaMb: Math.round((est.quota ?? 0) / 1048576),
    };
  } catch {
    return null;
  }
}
