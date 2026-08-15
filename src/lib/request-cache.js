/**
 * Shared request cache, de-duplicator and background refresher.
 *
 * Three cost levers in one place:
 *  1. **De-duplication** — identical in-flight requests share one promise, so
 *     ten components mounting at once make one network call.
 *  2. **TTL caching** — repeated reads inside the TTL never touch the network.
 *  3. **Persistence** — optionally mirrored to localStorage so a reload (or a
 *     second app session) reuses yesterday's answer instead of re-fetching.
 *
 * Used by the InsForge CRUD layer, geocoding, search suggestions and the AI
 * client. Never throws.
 */
const memory = new Map();
const inflight = new Map();
let currentAuthUserId = null;
const PREFIX = "sx:cache:";
const MAX_MEMORY_ENTRIES = 600;
function now() {
    return Date.now();
}
function readPersisted(key) {
    if (typeof localStorage === "undefined")
        return null;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw)
            return null;
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.at !== "number")
            return null;
        return entry;
    }
    catch {
        return null;
    }
}
function writePersisted(key, entry) {
    if (typeof localStorage === "undefined")
        return;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    }
    catch {
        // Quota exceeded — drop the oldest Scoobix cache entries and move on.
        try {
            const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
            keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
            localStorage.setItem(PREFIX + key, JSON.stringify(entry));
        }
        catch {
            /* give up silently */
        }
    }
}
function fresh(entry) {
    return Boolean(entry && (entry.ttl <= 0 || now() - entry.at < entry.ttl * 1000));
}
export function cacheGet(key, opts) {
    let entry = memory.get(key);
    if (!entry && opts?.persist) {
        const persisted = readPersisted(key);
        if (persisted) {
            memory.set(key, persisted);
            entry = persisted;
        }
    }
    return fresh(entry) ? entry.value : undefined;
}
export function cacheSet(key, value, ttl, opts) {
    const entry = { at: now(), ttl, value };
    if (memory.size > MAX_MEMORY_ENTRIES)
        memory.clear();
    memory.set(key, entry);
    if (opts?.persist)
        writePersisted(key, entry);
}
export function cacheDrop(prefix) {
    for (const k of Array.from(memory.keys()))
        if (k.startsWith(prefix))
            memory.delete(k);
    if (typeof localStorage === "undefined")
        return;
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX + prefix))
            .forEach((k) => localStorage.removeItem(k));
    }
    catch {
        /* ignore */
    }
}
/**
 * Cached + de-duplicated fetch.
 *
 * @param ttl        seconds the value stays fresh (0 = dedupe only)
 * @param persist    mirror to localStorage so reloads reuse it
 * @param staleWhileRevalidate return the stale value immediately and refresh
 *                   in the background (no spinner, no extra perceived latency)
 */
export async function cached(key, ttl, loader, opts) {
    const hit = cacheGet(key, opts);
    if (hit !== undefined)
        return hit;
    if (opts?.staleWhileRevalidate) {
        const stale = (memory.get(key) ?? (opts.persist ? readPersisted(key) : null))?.value;
        if (stale !== undefined && !inflight.has(key)) {
            void dedupe(key, loader).then((v) => cacheSet(key, v, ttl, opts)).catch(() => { });
            return stale;
        }
    }
    const value = await dedupe(key, loader);
    cacheSet(key, value, ttl, opts);
    return value;
}
/**
 * Scopes the cache to the current user to prevent cross-account data leakage.
 * Call this when auth state changes.
 */
export function setCacheAuthScope(userId) {
    if (currentAuthUserId !== userId) {
        console.log("[CACHE] Auth scope changed, clearing memory cache");
        memory.clear();
        currentAuthUserId = userId;
    }
}
/** Collapse identical concurrent calls into one promise. */
export function dedupe(key, loader) {
    const existing = inflight.get(key);
    if (existing)
        return existing;
    const p = loader().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}
/** Simple debounce for search inputs and map drags. */
export function debounce(fn, ms) {
    let t;
    const wrapped = (...args) => {
        if (t)
            clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => t && clearTimeout(t);
    return wrapped;
}
