/**
 * Shared request cache, de-duplicator and background refresher.
 * P0.1: User-scoped persistence to prevent cross-account identity leakage.
 */

type Entry = { at: number; ttl: number; value: unknown; userId?: string | null };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let currentAuthUserId: string | null = null;

const PREFIX = "sx:cache:";
const MAX_MEMORY_ENTRIES = 600;

function now() {
  return Date.now();
}

/**
 * P0.1: Scopes keys by userId to ensure isolation.
 */
function getScopedKey(key: string): string {
  if (!currentAuthUserId) return key;
  return `${currentAuthUserId}:${key}`;
}

function readPersisted(key: string): Entry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const scopedKey = getScopedKey(key);
    const raw = localStorage.getItem(PREFIX + scopedKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry;
    
    // P0.1: Validation - ensure this entry belongs to the current user (or no user)
    if (entry.userId !== currentAuthUserId) {
      localStorage.removeItem(PREFIX + scopedKey);
      return null;
    }
    
    if (!entry || typeof entry.at !== "number") return null;
    return entry;
  } catch {
    return null;
  }
}

function writePersisted(key: string, entry: Entry) {
  if (typeof localStorage === "undefined") return;
  try {
    const scopedKey = getScopedKey(key);
    const scopedEntry = { ...entry, userId: currentAuthUserId };
    localStorage.setItem(PREFIX + scopedKey, JSON.stringify(scopedEntry));
  } catch {
    // Quota exceeded cleanup
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
      keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

function fresh(entry: Entry | null | undefined): boolean {
  return Boolean(entry && (entry.ttl <= 0 || now() - entry.at < entry.ttl * 1000));
}

export function cacheGet<T>(key: string, opts?: { persist?: boolean }): T | undefined {
  const scopedKey = getScopedKey(key);
  let entry = memory.get(scopedKey);
  
  if (!entry && opts?.persist) {
    const persisted = readPersisted(key);
    if (persisted) {
      memory.set(scopedKey, persisted);
      entry = persisted;
    }
  }
  return fresh(entry) ? (entry!.value as T) : undefined;
}

export function cacheSet(key: string, value: unknown, ttl: number, opts?: { persist?: boolean }) {
  const entry: Entry = { at: now(), ttl, value, userId: currentAuthUserId };
  const scopedKey = getScopedKey(key);
  
  if (memory.size > MAX_MEMORY_ENTRIES) memory.clear();
  memory.set(scopedKey, entry);
  
  if (opts?.persist) writePersisted(key, entry);
}

export function cacheDrop(prefix: string) {
  const scopedPrefix = getScopedKey(prefix);
  for (const k of Array.from(memory.keys())) if (k.startsWith(scopedPrefix)) memory.delete(k);
  
  if (typeof localStorage === "undefined") return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX + scopedPrefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export async function cached<T>(
  key: string,
  ttl: number,
  loader: () => Promise<T>,
  opts?: { persist?: boolean; staleWhileRevalidate?: boolean },
): Promise<T> {
  const hit = cacheGet<T>(key, opts);
  if (hit !== undefined) return hit;

  const scopedKey = getScopedKey(key);

  if (opts?.staleWhileRevalidate) {
    const stale = (memory.get(scopedKey) ?? (opts.persist ? readPersisted(key) : null))?.value as T | undefined;
    if (stale !== undefined && !inflight.has(scopedKey)) {
      void dedupe(scopedKey, loader).then((v) => cacheSet(key, v, ttl, opts)).catch(() => {});
      return stale;
    }
  }

  const value = await dedupe(scopedKey, loader);
  cacheSet(key, value, ttl, opts);
  return value;
}

/** 
 * P0.1: Scopes the cache to the current user and clears memory on switch.
 */
export function setCacheAuthScope(userId: string | null) {
  if (currentAuthUserId !== userId) {
    console.log(`[CACHE] Auth scope changed to ${userId}, clearing memory cache`);
    memory.clear();
    currentAuthUserId = userId;
  }
}

/** Collapse identical concurrent calls into one promise. */
export function dedupe<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = loader().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => t && clearTimeout(t);
  return wrapped as typeof wrapped & { cancel: () => void };
}
