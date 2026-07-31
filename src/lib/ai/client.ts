/**
 * Client-side AI access layer.
 *
 * Components call `runAI` / `useAiTask` only — never a provider, never a
 * prompt. Everything is proxied to the server gateway at /api/public/ai.
 *
 * Cost controls applied here, before a request ever leaves the browser:
 *  - **Policy gate** — only capabilities in `AI_ALLOWED_TASKS` may call a model.
 *    Blocked surfaces (home, menu, cart, checkout, tracking, CMS, profile,
 *    settings) degrade to rule-based logic with zero provider spend.
 *  - **Persistent response cache** — identical task+input inside the task TTL
 *    is answered from localStorage, surviving reloads and navigation.
 *  - **De-duplication** — concurrent identical calls share one request.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { taskDef, type AiTask } from "./tasks";
import { aiTaskAllowed, effectiveTtl } from "./policy";
import { cacheGet, cacheSet, dedupe } from "../request-cache";
import { createRecord, listTable, patchRecord } from "../insforge-crud";
import { recordMetric } from "../perf-metrics";

export type AiResponse<T = unknown> = {
  ok: boolean;
  data: T | null;
  text: string;
  provider: string | null;
  cached: boolean;
  latencyMs: number;
  logId: string | null;
  error?: string;
  degraded?: boolean;
};

const EMPTY: AiResponse = {
  ok: false,
  data: null,
  text: "",
  provider: null,
  cached: false,
  latencyMs: 0,
  logId: null,
  degraded: true,
};

async function post<T>(
  task: string,
  input: unknown,
  opts?: { app?: string; userId?: string; fresh?: boolean; signal?: AbortSignal },
): Promise<AiResponse<T>> {
  try {
    const res = await fetch("/api/public/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, input, app: opts?.app, userId: opts?.userId, fresh: opts?.fresh }),
      signal: opts?.signal,
    });
    if (!res.ok) return { ...EMPTY, error: `http_${res.status}` } as AiResponse<T>;
    return (await res.json()) as AiResponse<T>;
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "network" } as AiResponse<T>;
  }
}

function hashInput(value: unknown): string {
  const s = JSON.stringify(value ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}${(h >>> 0).toString(36)}`;
}

/** Fire an AI task through the gateway. Never throws — degrades to `ok:false`. */
export async function runAI<T = unknown>(
  task: AiTask,
  input: unknown,
  opts?: { app?: string; userId?: string; fresh?: boolean; signal?: AbortSignal },
): Promise<AiResponse<T>> {
  if (!aiTaskAllowed(task)) {
    return { ...EMPTY, error: "task_not_permitted" } as AiResponse<T>;
  }

  const ttl = effectiveTtl(task, taskDef(task)?.ttl ?? 0);
  const key = `ai:${task}:${hashInput(input)}`;

  if (opts?.fresh || ttl <= 0) {
    const t0 = Date.now();
    const res = await dedupe(key + ":live", () => post<T>(task, input, opts));
    recordMetric({ kind: "ai", name: task, ms: Date.now() - t0, ok: !!res.ok, provider: res.provider ?? undefined });
    if (res.ok && ttl > 0) cacheSet(key, res, ttl, { persist: true });
    return res;
  }

  const hit = cacheGet<AiResponse<T>>(key, { persist: true });
  if (hit) {
    recordMetric({ kind: "ai", name: task, ms: 0, ok: true, cached: true, provider: hit.provider ?? undefined });
    return { ...hit, cached: true };
  }

  // Only successful answers are cached — a failure must be retryable.
  const t0 = Date.now();
  const res = await dedupe(key, () => post<T>(task, input, opts));
  recordMetric({ kind: "ai", name: task, ms: Date.now() - t0, ok: !!res.ok, provider: res.provider ?? undefined });
  if (res.ok) cacheSet(key, res, ttl, { persist: true });
  return res;
}



/**
 * Declarative hook for panels that render an AI result.
 * Auto-runs when `enabled` and re-runs when the input key changes.
 */
export function useAiTask<T = unknown>(
  task: AiTask,
  input: unknown,
  opts?: { app?: string; userId?: string; enabled?: boolean; fresh?: boolean },
) {
  const [state, setState] = useState<{ loading: boolean; data: T | null; res: AiResponse<T> | null }>({
    loading: false,
    data: null,
    res: null,
  });
  const key = JSON.stringify(input ?? null);
  const enabled = opts?.enabled ?? true;
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const run = useCallback(
    async (fresh?: boolean) => {
      setState((s) => ({ ...s, loading: true }));
      const res = await runAI<T>(task, JSON.parse(key), { app: opts?.app, userId: opts?.userId, fresh: fresh ?? opts?.fresh });
      if (!alive.current) return res;
      setState({ loading: false, data: (res.data as T) ?? null, res });
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, key, opts?.app, opts?.userId, opts?.fresh],
  );

  useEffect(() => {
    if (!enabled) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return { ...state, refresh: () => run(true), run };
}

/* ───────────────── AI analytics (client-side, anon-scoped) ───────────────── */

export async function logAiSearch(entry: {
  userId?: string;
  app: string;
  query: string;
  intent?: unknown;
  resultsCount: number;
  sessionId?: string;
}) {
  const term = entry.query.trim().toLowerCase().slice(0, 120);
  if (!term) return;
  await Promise.all([
    createRecord("ai_search_history", {
      user_id: entry.userId ?? null,
      app: entry.app,
      query: term,
      intent: entry.intent ?? null,
      results_count: entry.resultsCount,
      session_id: entry.sessionId ?? null,
    }),
    createRecord("search_analytics", {
      term,
      app: entry.app,
      user_id: entry.userId ?? null,
      results_count: entry.resultsCount,
      zero_result: entry.resultsCount === 0,
      source: "ai",
    }),
    bumpTrending(term, entry.resultsCount),
  ]);
}

async function bumpTrending(term: string, resultsCount: number) {
  const rows = await listTable<{ id: string; hits?: number }>("trending_searches", { term: `eq.${term}`, limit: 1 });
  const now = new Date().toISOString();
  if (rows[0]?.id) {
    await patchRecord("trending_searches", rows[0].id, {
      hits: (rows[0].hits ?? 0) + 1,
      results_count: resultsCount,
      last_seen: now,
    });
  } else {
    await createRecord("trending_searches", { term, hits: 1, results_count: resultsCount, last_seen: now });
  }
}

/** Mark a search as converted (customer opened a result / ordered). */
export async function markSearchConverted(term: string) {
  const t = term.trim().toLowerCase();
  const rows = await listTable<{ id: string }>("search_analytics", { term: `eq.${t}`, order: "created_at.desc", limit: 1 });
  if (rows[0]?.id) await patchRecord("search_analytics", rows[0].id, { converted: true });
}

export async function submitAiFeedback(entry: {
  userId?: string;
  app: string;
  task: string;
  logId?: string | null;
  rating: 1 | -1;
  comment?: string;
}) {
  await createRecord("ai_feedback", {
    user_id: entry.userId ?? null,
    app: entry.app,
    task: entry.task,
    log_id: entry.logId ?? null,
    rating: entry.rating,
    comment: entry.comment ?? null,
  });
}

/** Persist one turn of an AI conversation. */
export async function logAiChat(entry: {
  userId?: string;
  app: string;
  sessionId: string;
  role: "user" | "assistant";
  message: string;
  task: string;
}) {
  await createRecord("ai_chat_history", {
    user_id: entry.userId ?? null,
    app: entry.app,
    session_id: entry.sessionId,
    role: entry.role,
    message: entry.message.slice(0, 4000),
    task: entry.task,
  });
}

/** Read + write the learned customer preference profile. */
export async function getCustomerPreferences(userId: string) {
  const rows = await listTable<Record<string, unknown>>("customer_preferences", { user_id: `eq.${userId}`, limit: 1 });
  return rows[0] ?? null;
}

export async function saveCustomerPreferences(userId: string, patch: Record<string, unknown>) {
  const rows = await listTable<{ id: string }>("customer_preferences", { user_id: `eq.${userId}`, limit: 1 });
  if (rows[0]?.id) await patchRecord("customer_preferences", rows[0].id, patch);
  else await createRecord("customer_preferences", { user_id: userId, ...patch });
}

/** Record that a recommendation block was shown / clicked. */
export async function logRecommendation(entry: { userId?: string; section: string; payload: unknown; model?: string }) {
  await createRecord("ai_recommendations", {
    user_id: entry.userId ?? null,
    section: entry.section,
    payload: entry.payload,
    model: entry.model ?? null,
    shown: 1,
    clicked: 0,
  });
}
