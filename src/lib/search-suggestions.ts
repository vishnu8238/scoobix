/**
 * Search suggestions (popular / trending / entity suggestions).
 *
 * These lists change slowly but are read on every visit to the search screen,
 * so they are cached on disk and refreshed in the background (stale-while-
 * revalidate) instead of re-queried on every request. Falls back to the
 * static popular list when the backend has no data yet.
 */
import { listTable } from "./insforge-crud";
import { cached } from "./request-cache";
import { popularSearches } from "./mock-data";

const TTL = 30 * 60; // 30 min, refreshed in the background

type TrendingRow = { term?: string; hits?: number };

/** Most-searched terms platform-wide, refreshed in the background. */
export async function getTrendingSearches(limit = 10): Promise<string[]> {
  const rows = await cached<TrendingRow[]>(
    `search:trending:${limit}`,
    TTL,
    () => listTable<TrendingRow>("trending_searches", { order: "-hits", limit, select: "term,hits" }, { ttl: TTL }),
    { persist: true, staleWhileRevalidate: true },
  );
  const terms = rows.map((r) => (r.term ?? "").trim()).filter(Boolean);
  return terms.length ? terms : [];
}

/** Suggestion chips for an empty search box: live trending, else the defaults. */
export async function getPopularSearches(limit = 10): Promise<string[]> {
  const trending = await getTrendingSearches(limit).catch(() => []);
  if (trending.length >= 4) return trending.slice(0, limit);
  const merged = Array.from(new Set([...trending, ...popularSearches]));
  return merged.slice(0, limit);
}
