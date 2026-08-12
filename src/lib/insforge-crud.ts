//  DATABASE ACCESS LAYER AUDIT
/**
 * Generic InsForge CRUD helper.
 *
 * All operations are best-effort with a single retry on failure. Never throws
 * — stores stay usable when the backend is unreachable.
 */
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { cached, cacheDrop, cacheGet } from "./request-cache";
import { recordMetric } from "./perf-metrics";
import { publishTableChange, onAnyChange } from "./realtime-bus";

// Any realtime change — from this client or another one — drops the cached
// reads for that table so the next fetch is authoritative.
if (typeof window !== "undefined") {
  onAnyChange((p) => { if (p?.table) cacheDrop(`db:${p.table}?`); });
}

/** Announce a write so every other open client updates without polling. */
function announce(
  table: string,
  op: "insert" | "update" | "delete",
  row?: Record<string, unknown> | null,
) {
  try { publishTableChange(table, op, row ?? undefined); } catch { /* best-effort */ }
}



/** Default read TTL (seconds). Short enough to feel live, long enough to
 *  collapse the repeated reads a multi-panel dashboard fires on mount. */
const READ_TTL = 20;
/** Hard page size — never let a query pull an unbounded table. */
const MAX_ROWS = 200;

type Method = "GET" | "POST" | "PATCH" | "DELETE";

import { insforge, getAccessToken } from "./insforge";

const HEADERS = async (isPublic: boolean = false) => {
  // Authoritative session check using the SDK's internal state.
  // Standard SDK behavior: getAccessToken() is async to ensure session hydration from cookies.
  const token = await getAccessToken();

  if (!isPublic && !token) {
    console.error("[AUTH_ERROR] Authenticated request attempted without a valid session.");
    throw new HttpError(401, "Authentication required");
  }

  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${INSFORGE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
};


class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function metricName(method: Method, url: string) {
  const table = url.split("/records/")[1]?.split("?")[0] ?? url;
  return `${method} ${table}`;
}

async function once(url: string, method: Method, body?: unknown, isPublic: boolean = false) {
  const t0 = Date.now();
  const headers = await HEADERS(isPublic);
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  recordMetric({
    kind: "api",
    name: metricName(method, url),
    ms: Date.now() - t0,
    ok: res.ok,
    status: res.status,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.message || body?.error || `${method} ${url} → ${res.status}`;
    console.error(" listTable: HTTP Error from server:", { status: res.status, url, method, message });
    throw new HttpError(res.status, message);
  }

  // Some DELETE responses have no body.
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/**
 * Retry ONLY when it can help: network failures, 429 and 5xx. A 4xx is a bad
 * request — retrying just doubles the cost and the latency.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 0;
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable) throw err;
    
    console.warn(` listTable: Retrying request after ${status || "network"} error`);
    await new Promise((r) => setTimeout(r, 500));
    return await fn();
  }
}


const base = (table: string) => `${INSFORGE_URL}/api/database/records/${table}`;

function normalizeParam(k: string, v: string | number): string {
  // Translate leading "-" / "+" order shorthand into PostgREST `field.desc`/`.asc`.
  if (k === "order" && typeof v === "string") {
    return v
      .split(",")
      .map((s) => {
        const t = s.trim();
        if (!t) return t;
        if (t.startsWith("-")) return `${t.slice(1)}.desc`;
        if (t.startsWith("+")) return `${t.slice(1)}.asc`;
        return t.includes(".") ? t : `${t}.asc`;
      })
      .join(",");
  }
  return String(v);
}

function buildQuery(params?: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "");
  // Always bound the result set — an unbounded read is the single biggest
  // source of egress cost and slow screens.
  if (!entries.some(([k]) => k === "limit")) entries.push(["limit", MAX_ROWS]);
  const capped = entries.map(([k, v]) =>
    k === "limit" ? [k, Math.min(Number(v) || MAX_ROWS, MAX_ROWS)] : [k, v],
  ) as [string, string | number][];
  return (
    "?" +
    capped
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(normalizeParam(k, v))}`)
      .join("&")
  );
}

/**
 * Read rows. Cached + de-duplicated: identical queries fired by several
 * panels in the same moment collapse into one request, and repeats inside
 * `ttl` seconds are served from memory.
 *
 * Pass `select` to limit returned fields, and `limit`/`offset` for
 * server-side pagination.
 */
export function listTable<T = Record<string, unknown>>(
  table: string,
  params?: Record<string, string | number | undefined>,
  opts?: { ttl?: number; fresh?: boolean; public?: boolean },
): Promise<T[]> {
  const qs = buildQuery(params);
  const url = `${base(table)}${qs}`;
  const load = () => withRetry(() => once(url, "GET", undefined, opts?.public)).then((v) => (Array.isArray(v) ? (v as T[]) : []));
  
  if (!opts?.fresh && cacheGet<T[]>(`db:${table}${qs}`) !== undefined) {
    recordMetric({ kind: "api", name: `GET ${table}`, ms: 0, ok: true, cached: true });
  }
  
  if (opts?.fresh) {
    invalidateTable(table);
    return load();
  }
  
  return cached<T[]>(`db:${table}${qs}`, opts?.ttl ?? READ_TTL, load);
}

/** Server-side pagination helper. */
export function listPage<T = Record<string, unknown>>(
  table: string,
  page: number,
  pageSize: number,
  params?: Record<string, string | number | undefined>,
  opts?: { ttl?: number; public?: boolean },
): Promise<T[]> {
  const size = Math.min(Math.max(pageSize, 1), MAX_ROWS);
  return listTable<T>(table, { ...params, limit: size, offset: Math.max(page, 0) * size }, opts);
}

/** Drop cached reads for a table (called automatically after every write). */
export function invalidateTable(table: string) {
  cacheDrop(`db:${table}?`);
}

function firstRow(v: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(v)) return v[0] as Record<string, unknown> | undefined;
  return (v ?? undefined) as Record<string, unknown> | undefined;
}

export function createRecord<T = Record<string, unknown>>(
  table: string,
  record: Record<string, unknown>,
): Promise<T | null> {
  invalidateTable(table);
  return (withRetry(() => once(base(table), "POST", record)) as Promise<T | null>).then((res) => {
    announce(table, "insert", firstRow(res) ?? record);
    return res;
  });
}

/** Batch insert — one round trip instead of N. */
export function createRecords<T = Record<string, unknown>>(
  table: string,
  records: Record<string, unknown>[],
): Promise<T[] | null> {
  if (!records.length) return Promise.resolve([]);
  invalidateTable(table);
  return (withRetry(() => once(base(table), "POST", records)) as Promise<T[] | null>).then((res) => {
    announce(table, "insert", firstRow(res) ?? records[0]);
    return res;
  });
}

export function patchRecord<T = Record<string, unknown>>(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<T | null> {
  invalidateTable(table);
  return (
    withRetry(() => once(`${base(table)}?id=eq.${id}`, "PATCH", patch)) as Promise<T | null>
  ).then((res) => {
    announce(table, "update", { id, ...patch, ...(firstRow(res) ?? {}) });
    return res;
  });
}

/** Batch update — apply the same patch to many ids in one request. */
export function patchWhereIn<T = Record<string, unknown>>(
  table: string,
  ids: string[],
  patch: Record<string, unknown>,
): Promise<T | null> {
  if (!ids.length) return Promise.resolve(null);
  invalidateTable(table);
  const filter = `id=in.(${ids.join(",")})`;
  return (
    withRetry(() => once(`${base(table)}?${filter}`, "PATCH", patch)) as Promise<T | null>
  ).then((res) => {
    for (const id of ids.slice(0, 20)) announce(table, "update", { id, ...patch });
    return res;
  });
}

export function deleteRecord(table: string, id: string): Promise<null> {
  invalidateTable(table);
  return withRetry(() => once(`${base(table)}?id=eq.${id}`, "DELETE")).then(() => {
    announce(table, "delete", { id });
    return null;
  });
}


