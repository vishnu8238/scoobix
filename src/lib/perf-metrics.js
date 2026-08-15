/**
 * Lightweight platform telemetry.
 *
 * Every InsForge read/write and every AI task reports here. Metrics are kept
 * in memory (rolling window) and mirrored to localStorage so the admin
 * performance dashboard can render without a single extra backend call.
 *
 * Zero infra cost: nothing is sent to a server, nothing is polled.
 */
const KEY = "sx:perf:samples";
const MAX_SAMPLES = 500;
const SLOW_MS = 800;
let samples = [];
let hydrated = false;
let flushTimer;
const listeners = new Set();
function hydrate() {
    if (hydrated || typeof localStorage === "undefined")
        return;
    hydrated = true;
    try {
        const raw = localStorage.getItem(KEY);
        if (raw)
            samples = JSON.parse(raw).slice(-MAX_SAMPLES);
    }
    catch {
        /* ignore */
    }
}
/** Batched persist — never write to disk on the hot path. */
function schedulePersist() {
    if (typeof localStorage === "undefined" || flushTimer)
        return;
    flushTimer = setTimeout(() => {
        flushTimer = undefined;
        try {
            localStorage.setItem(KEY, JSON.stringify(samples.slice(-MAX_SAMPLES)));
        }
        catch {
            /* quota — drop silently */
        }
        listeners.forEach((l) => l());
    }, 2000);
}
export function recordMetric(sample) {
    hydrate();
    samples.push({ ...sample, at: sample.at ?? Date.now() });
    if (samples.length > MAX_SAMPLES)
        samples = samples.slice(-MAX_SAMPLES);
    schedulePersist();
}
/** Time an async call and record the outcome. Re-throws nothing extra. */
export async function timed(kind, name, fn, meta) {
    const t0 = Date.now();
    try {
        const out = await fn();
        recordMetric({ kind, name, ms: Date.now() - t0, ok: true, ...meta });
        return out;
    }
    catch (err) {
        const status = typeof err?.status === "number" ? err.status : 0;
        recordMetric({ kind, name, ms: Date.now() - t0, ok: false, status, ...meta });
        throw err;
    }
}
export function subscribeMetrics(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
export function getSamples(windowMs = 60 * 60 * 1000) {
    hydrate();
    const cutoff = Date.now() - windowMs;
    return samples.filter((s) => s.at >= cutoff);
}
export function clearMetrics() {
    samples = [];
    try {
        localStorage.removeItem(KEY);
    }
    catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}
function pct(list, p) {
    if (!list.length)
        return 0;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function localStorageKb() {
    if (typeof localStorage === "undefined")
        return 0;
    try {
        let chars = 0;
        for (const k of Object.keys(localStorage))
            chars += k.length + (localStorage.getItem(k)?.length ?? 0);
        return Math.round((chars * 2) / 1024);
    }
    catch {
        return 0;
    }
}
export function summarize(windowMs = 60 * 60 * 1000) {
    const rows = getSamples(windowMs);
    const api = rows.filter((r) => r.kind === "api");
    const ai = rows.filter((r) => r.kind === "ai");
    const apiLive = api.filter((r) => !r.cached);
    const failed = rows.filter((r) => !r.ok);
    const byName = new Map();
    for (const r of api) {
        const e = byName.get(r.name) ?? { calls: 0, total: 0, max: 0 };
        e.calls += 1;
        e.total += r.ms;
        e.max = Math.max(e.max, r.ms);
        byName.set(r.name, e);
    }
    const providers = new Map();
    for (const r of ai)
        if (r.provider)
            providers.set(r.provider, (providers.get(r.provider) ?? 0) + 1);
    const mem = performance.memory;
    return {
        apiCalls: api.length,
        apiCached: api.length - apiLive.length,
        apiCacheRate: api.length ? (api.length - apiLive.length) / api.length : 0,
        apiAvgMs: apiLive.length ? Math.round(apiLive.reduce((s, r) => s + r.ms, 0) / apiLive.length) : 0,
        apiP95Ms: Math.round(pct(apiLive.map((r) => r.ms), 95)),
        failed: failed.length,
        failureRate: rows.length ? failed.length / rows.length : 0,
        aiCalls: ai.length,
        aiCached: ai.filter((r) => r.cached).length,
        aiCacheRate: ai.length ? ai.filter((r) => r.cached).length / ai.length : 0,
        aiAvgMs: ai.length ? Math.round(ai.reduce((s, r) => s + r.ms, 0) / ai.length) : 0,
        providers: [...providers.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        slowest: [...byName.entries()]
            .filter(([, e]) => e.max >= SLOW_MS)
            .map(([name, e]) => ({ name, ms: e.max, calls: e.calls }))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 8),
        topEndpoints: [...byName.entries()]
            .map(([name, e]) => ({ name, calls: e.calls, avgMs: Math.round(e.total / e.calls) }))
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 10),
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        memoryLimitMb: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
        storageKb: localStorageKb(),
        storageQuotaMb: null,
    };
}
