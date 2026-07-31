/**
 * Server-only InsForge access for the AI gateway.
 *
 * Uses the privileged INSFORGE_API_KEY (never shipped to the browser) so that
 * AI logging, caching and analytics writes cannot be forged by clients.
 * Every helper is best-effort: telemetry failures must never break an AI call.
 */

const URL_BASE = "https://awvs3seh.us-east.insforge.app";

function key() {
  return process.env.INSFORGE_API_KEY ?? "";
}

function headers() {
  const k = key();
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
    "Content-Type": "application/json",
  };
}

const rec = (table: string) => `${URL_BASE}/api/database/records/${table}`;

export async function dbSelect<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  try {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const res = await fetch(`${rec(table)}${qs ? `?${qs}` : ""}`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? (json as T[]) : [];
  } catch {
    return [];
  }
}

export async function dbInsert(table: string, row: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${rec(table)}?select=*`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!res.ok) return null;
    const txt = await res.text();
    const parsed = txt ? JSON.parse(txt) : null;
    return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
  } catch {
    return null;
  }
}

export async function dbPatch(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${rec(table)}?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(patch) });
  } catch {
    /* telemetry is best-effort */
  }
}

export async function dbDeleteWhere(table: string, filter: string): Promise<void> {
  try {
    await fetch(`${rec(table)}?${filter}`, { method: "DELETE", headers: headers() });
  } catch {
    /* best-effort */
  }
}
