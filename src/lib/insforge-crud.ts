/**
 * Generic InsForge CRUD helper.
 *
 * All operations are best-effort with a single retry on failure. Never throws
 * — stores stay usable when the backend is unreachable.
 */
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function once(url: string, method: Method, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  // Some DELETE responses have no body.
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    try {
      return await fn();
    } catch {
      return null;
    }
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

export function listTable<T = Record<string, unknown>>(
  table: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(normalizeParam(k, v as string | number))}`)
        .join("&")
    : "";
  return withRetry(() => once(`${base(table)}${qs}`, "GET")).then((v) => (Array.isArray(v) ? (v as T[]) : []));
}

export function createRecord<T = Record<string, unknown>>(
  table: string,
  record: Record<string, unknown>,
): Promise<T | null> {
  return withRetry(() => once(base(table), "POST", record)) as Promise<T | null>;
}

export function patchRecord<T = Record<string, unknown>>(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<T | null> {
  return withRetry(() => once(`${base(table)}/${id}`, "PATCH", patch)) as Promise<T | null>;
}

export function deleteRecord(table: string, id: string): Promise<null> {
  return withRetry(() => once(`${base(table)}/${id}`, "DELETE")).then(() => null);
}
