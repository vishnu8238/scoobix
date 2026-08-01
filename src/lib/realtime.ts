/**
 * Realtime data layer for Scoobix.
 *
 * InsForge exposes REST only, so this module implements an adaptive-polling
 * transport with exponential backoff on idle and instant refresh on any
 * mutation. Callers use `subscribeTable(table, opts, onRows)` and get a
 * stream of row snapshots; when a mutation is written we call
 * `nudgeTable(table)` so every subscriber re-fetches immediately.
 *
 * Design goals
 *  - No new tables. Uses existing InsForge tables verbatim.
 *  - Battery-friendly: 4 s while active, backs off to 60 s when quiet, jumps
 *    straight back to the fast interval on any local write.
 *  - Visibility-aware: pauses when the tab is hidden, resumes on focus.
 *  - Filter-aware: matches server params locally so multiple subscribers on
 *    the same table share a single request.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { onTableChange, realtimeConnected, onRealtimeState } from "./realtime-bus";

/** Poll interval used purely as a safety net while realtime is connected. */
const SAFETY_NET_MS = 120_000;


type Row = Record<string, unknown>;

type Filter = Partial<Record<string, string | number | boolean | null>>;

export type SubscribeOptions = {
  /** Server query params (?limit=..., ?order=...). */
  params?: Record<string, string | number | undefined>;
  /** Local filter applied to every row before emission. */
  match?: Filter;
  /** Base poll interval in ms. Defaults to 4000. */
  minMs?: number;
  /** Max poll interval when idle. Defaults to 60000. */
  maxMs?: number;
};

type Listener = { match?: Filter; cb: (rows: Row[]) => void };

type StreamState = {
  table: string;
  params?: Record<string, string | number | undefined>;
  listeners: Set<Listener>;
  lastRows: Row[];
  lastKey: string;
  timer: number | null;
  currentMs: number;
  minMs: number;
  maxMs: number;
  inFlight: boolean;
  disposed: boolean;
};

const streams = new Map<string, StreamState>();

function streamKey(table: string, params?: Record<string, string | number | undefined>) {
  if (!params) return table;
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : 1));
  if (entries.length === 0) return table;
  return `${table}?${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

function normalizeParamValue(k: string, v: string | number): string {
  // InsForge/PostgREST expects `order=field.desc`/`.asc`. Translate the leading
  // "-" shorthand (e.g. "-created_at") we use across the codebase.
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

function paramsUrl(table: string, params?: Record<string, string | number | undefined>) {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(normalizeParamValue(k, v as string | number))}`)
        .join("&")
    : "";
  return `${INSFORGE_URL}/api/database/records/${table}${qs}`;
}

function matches(row: Row, filter?: Filter): boolean {
  if (!filter) return true;
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined) continue;
    if ((row as Row)[k] !== v) return false;
  }
  return true;
}

function rowKey(rows: Row[]): string {
  // Cheap change detector: id+updated_at|status+len.
  let key = String(rows.length);
  for (const r of rows) {
    const id = r.id ?? "";
    const upd = r.updated_at ?? r.status ?? "";
    key += `|${id}:${upd}`;
  }
  return key;
}

async function fetchOnce(table: string, params?: Record<string, string | number | undefined>): Promise<Row[]> {
  const res = await fetch(paramsUrl(table, params), {
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`realtime ${table} → ${res.status}`);
  const data = (await res.json()) as Row[];
  return Array.isArray(data) ? data : [];
}

function pollMs(state: StreamState) {
  // With realtime connected, polling is only a safety net: stretch it hard.
  if (realtimeConnected()) return Math.max(state.currentMs, SAFETY_NET_MS);
  return state.currentMs;
}

function schedule(state: StreamState) {
  if (state.disposed) return;
  if (state.timer) window.clearTimeout(state.timer);
  if (typeof document !== "undefined" && document.hidden) {
    state.timer = window.setTimeout(() => schedule(state), 4000);
    return;
  }
  state.timer = window.setTimeout(() => void tick(state), pollMs(state));
}


async function tick(state: StreamState) {
  if (state.disposed || state.inFlight) return;
  state.inFlight = true;
  try {
    const rows = await fetchOnce(state.table, state.params);
    const key = rowKey(rows);
    if (key !== state.lastKey) {
      state.lastKey = key;
      state.lastRows = rows;
      state.currentMs = state.minMs;
      for (const l of state.listeners) {
        try { l.cb(rows.filter((r) => matches(r, l.match))); } catch { /* ignore */ }
      }
    } else {
      state.currentMs = Math.min(state.maxMs, Math.round(state.currentMs * 1.5));
    }
  } catch {
    state.currentMs = Math.min(state.maxMs, Math.round(state.currentMs * 2));
  } finally {
    state.inFlight = false;
    schedule(state);
  }
}

export function subscribeTable(
  table: string,
  opts: SubscribeOptions,
  cb: (rows: Row[]) => void,
): () => void {
  const key = streamKey(table, opts.params);
  let state = streams.get(key);
  if (!state) {
    state = {
      table,
      params: opts.params,
      listeners: new Set(),
      lastRows: [],
      lastKey: "__init__",
      timer: null,
      // Cost guard: 4 s while something is actually changing, backing off to
      // 60 s when a screen is idle. A mutation calls `nudgeTable` and snaps
      // the stream back to the fast interval, so this is not felt in the UI.
      currentMs: opts.minMs ?? 4000,
      minMs: opts.minMs ?? 4000,
      maxMs: opts.maxMs ?? 60000,
      inFlight: false,
      disposed: false,
    };
    streams.set(key, state);
    // Kick off immediately.
    void tick(state);
  } else {
    // Emit cached snapshot so late subscribers render synchronously.
    try { cb(state.lastRows.filter((r) => matches(r, opts.match))); } catch { /* */ }
  }
  const listener: Listener = { match: opts.match, cb };
  state.listeners.add(listener);
  return () => {
    state!.listeners.delete(listener);
    if (state!.listeners.size === 0) {
      state!.disposed = true;
      if (state!.timer) window.clearTimeout(state!.timer);
      streams.delete(key);
    }
  };
}

/** After a local mutation, force every subscriber on `table` to re-fetch. */
export function nudgeTable(table: string) {
  for (const [key, state] of streams) {
    if (state.table === table) {
      state.currentMs = state.minMs;
      if (state.timer) window.clearTimeout(state.timer);
      void tick(state);
      void key;
    }
  }
}

// Global focus/visibility handlers — nudge everything on wake so the UI is
// never stale after the user returns to the tab.
if (typeof window !== "undefined") {
  const wake = () => {
    for (const state of streams.values()) {
      state.currentMs = state.minMs;
      if (state.timer) window.clearTimeout(state.timer);
      void tick(state);
    }
  };
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
}
