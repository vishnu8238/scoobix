/**
 * Admin AI Console — provider priority & toggles, quotas, latency/failure
 * telemetry, feature kill-switches, cache purge and AI usage analytics.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { kvGet, kvSet } from "@/lib/kv-store";
import { listTable } from "@/lib/insforge-crud";
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS, mergeAiSettings, type AiSettings, type ProviderId } from "@/lib/ai/settings";
import { AI_TASKS, AI_TASK_IDS, type AiTask } from "@/lib/ai/tasks";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/admin/ai-console")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · AI Console" },
      { name: "description", content: "Configure AI providers, priority, quotas, caching and feature switches for the Scoobix AI gateway." },
      { property: "og:title", content: "Scoobix Admin · AI Console" },
      { property: "og:description", content: "Provider health, quotas, latency and AI analytics in one console." },
    ],
  }),
  component: AiConsole,
});

type Health = { id: ProviderId; label: string; model: string; free: boolean; configured?: boolean; enabled?: boolean };
type UsageRow = { provider?: string; task?: string; status?: string; latency_ms?: number; cached?: boolean; created_at?: string; error?: string };

function AiConsole() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [health, setHealth] = useState<Health[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [searches, setSearches] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [raw, h, u, s, f] = await Promise.all([
      kvGet<AiSettings>(AI_SETTINGS_KEY),
      fetch("/api/public/ai/health").then((r) => r.json()).catch(() => ({ providers: [] })),
      listTable<UsageRow>("ai_usage_logs", { order: "-created_at", limit: 400 }),
      listTable<any>("trending_searches", { order: "-hits", limit: 20 }),
      listTable<any>("ai_feedback", { order: "-created_at", limit: 200 }),
    ]);
    setSettings(mergeAiSettings(raw));
    setHealth(h?.providers ?? []);
    setUsage(u);
    setSearches(s);
    setFeedback(f);
  };

  useEffect(() => { void load(); }, []);

  const save = async (next: AiSettings) => {
    setSettings(next);
    setSaving(true);
    await kvSet(AI_SETTINGS_KEY, next);
    await post("refresh_settings");
    setSaving(false);
  };

  const post = async (action: "clear_cache" | "refresh_settings", task?: string) => {
    if (!user?.email) return;
    const res = await fetch("/api/public/ai/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, task, email: user.email }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (!res.ok && action === "clear_cache") toast.error("Not authorised");
    else if (action === "clear_cache") toast.success("AI cache cleared");
  };

  const stats = useMemo(() => {
    const byProvider: Record<string, { calls: number; errors: number; latency: number; cached: number }> = {};
    for (const r of usage) {
      const k = r.provider ?? "none";
      byProvider[k] ??= { calls: 0, errors: 0, latency: 0, cached: 0 };
      byProvider[k].calls += 1;
      byProvider[k].latency += Number(r.latency_ms ?? 0);
      if (r.status && r.status !== "ok") byProvider[k].errors += 1;
      if (r.cached) byProvider[k].cached += 1;
    }
    const byTask: Record<string, number> = {};
    for (const r of usage) byTask[r.task ?? "?"] = (byTask[r.task ?? "?"] ?? 0) + 1;
    const up = feedback.filter((f) => f.rating === 1).length;
    return {
      byProvider,
      topTasks: Object.entries(byTask).sort((a, b) => b[1] - a[1]).slice(0, 10),
      total: usage.length,
      cacheHitRate: usage.length ? Math.round((usage.filter((u) => u.cached).length / usage.length) * 100) : 0,
      avgLatency: usage.length ? Math.round(usage.reduce((s, u) => s + Number(u.latency_ms ?? 0), 0) / usage.length) : 0,
      errorRate: usage.length ? Math.round((usage.filter((u) => u.status && u.status !== "ok").length / usage.length) * 100) : 0,
      satisfaction: feedback.length ? Math.round((up / feedback.length) * 100) : null,
      recentErrors: usage.filter((u) => u.error).slice(0, 12),
    };
  }, [usage, feedback]);

  const move = (id: ProviderId, dir: -1 | 1) => {
    const list = [...settings.priority];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    void save({ ...settings, priority: list });
  };

  const allProviders = useMemo(() => {
    const ids = new Set<ProviderId>([...settings.priority, ...(health.map((h) => h.id) as ProviderId[])]);
    return Array.from(ids);
  }, [settings.priority, health]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">AI Console</h1>
          <p className="text-sm text-muted-foreground">Providers, quotas, caching and analytics for the AI gateway.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          <button onClick={() => void post("clear_cache")} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Clear cache
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="AI requests" value={String(stats.total)} />
        <Stat label="Avg latency" value={`${stats.avgLatency} ms`} />
        <Stat label="Cache hit rate" value={`${stats.cacheHitRate}%`} />
        <Stat label="Error rate" value={`${stats.errorRate}%`} tone={stats.errorRate > 15 ? "bad" : "good"} />
      </div>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Master switch</h2>
          <Toggle on={settings.enabled} onChange={(v) => void save({ ...settings, enabled: v })} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          When off, every AI surface degrades gracefully and the rest of Scoobix keeps working.
        </p>
      </section>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="text-sm font-bold">Providers & priority</h2>
        <div className="mt-3 space-y-2">
          {allProviders.map((id, idx) => {
            const h = health.find((x) => x.id === id);
            const p = stats.byProvider[id];
            const on = settings.providers[id] ?? false;
            return (
              <div key={id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/50 p-3 ring-1 ring-border/40">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-card text-xs font-bold">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {h?.label ?? id}
                    {h?.free && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">free</span>}
                    {h && !h.configured && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">no key</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h?.model ?? "—"}
                    {p ? ` · ${p.calls} calls · ${Math.round(p.latency / Math.max(p.calls, 1))}ms · ${p.errors} errors` : " · no traffic"}
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={settings.monthlyQuota[id] ?? 0}
                  onChange={(e) => void save({ ...settings, monthlyQuota: { ...settings.monthlyQuota, [id]: Number(e.target.value) } })}
                  className="h-9 w-28 rounded-xl bg-card px-2 text-xs ring-1 ring-border/60"
                  title="Monthly quota (0 = unlimited)"
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => move(id, -1)} className="grid h-8 w-8 place-items-center rounded-full bg-card"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(id, 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <Toggle on={on} onChange={(v) => void save({ ...settings, providers: { ...settings.providers, [id]: v } })} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          New providers (OpenAI, Claude, DeepSeek, Grok, Mistral, Ollama, Qwen, Llama) appear here automatically once their key is added — no app changes needed.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="text-sm font-bold">Runtime limits</h2>
          <Num label="Rate limit / user / min" value={settings.rateLimitPerMin} onChange={(v) => void save({ ...settings, rateLimitPerMin: v })} />
          <Num label="Max retries per provider" value={settings.maxRetries} onChange={(v) => void save({ ...settings, maxRetries: v })} />
          <Num label="Provider timeout (ms)" value={settings.timeoutMs} onChange={(v) => void save({ ...settings, timeoutMs: v })} />
          <Num label="Cache TTL factor" value={settings.cacheTtlFactor} step={0.5} onChange={(v) => void save({ ...settings, cacheTtlFactor: v })} />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Response cache</span>
            <Toggle on={settings.cache} onChange={(v) => void save({ ...settings, cache: v })} />
          </div>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="text-sm font-bold">Top AI tasks</h2>
          <ul className="mt-3 space-y-1.5">
            {stats.topTasks.length === 0 && <li className="text-sm text-muted-foreground">No AI traffic yet.</li>}
            {stats.topTasks.map(([t, n]) => (
              <li key={t} className="flex items-center justify-between text-sm">
                <span className="truncate">{AI_TASKS[t as AiTask]?.label ?? t}</span>
                <span className="font-bold">{n}</span>
              </li>
            ))}
          </ul>
          {stats.satisfaction !== null && (
            <p className="mt-3 text-xs text-muted-foreground">User satisfaction: <b className="text-foreground">{stats.satisfaction}%</b> positive ({feedback.length} ratings)</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="text-sm font-bold">Feature switches</h2>
        <p className="text-xs text-muted-foreground">Disable individual AI features without touching code.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AI_TASK_IDS.map((t) => {
            const off = settings.disabledTasks.includes(t);
            return (
              <button
                key={t}
                onClick={() =>
                  void save({
                    ...settings,
                    disabledTasks: off ? settings.disabledTasks.filter((x) => x !== t) : [...settings.disabledTasks, t],
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                  off ? "border-destructive/40 bg-destructive/10 text-destructive line-through" : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {AI_TASKS[t].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="text-sm font-bold">Trending searches</h2>
          <ul className="mt-3 space-y-1.5">
            {searches.length === 0 && <li className="text-sm text-muted-foreground">No searches logged yet.</li>}
            {searches.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.term}</span>
                <span className={cn("font-bold", (s.results_count ?? 1) === 0 && "text-destructive")}>{s.hits}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="text-sm font-bold">Recent failures</h2>
          <ul className="mt-3 space-y-1.5">
            {stats.recentErrors.length === 0 && <li className="text-sm text-muted-foreground">No failures recorded.</li>}
            {stats.recentErrors.map((e, i) => (
              <li key={i} className="rounded-xl bg-destructive/5 px-2.5 py-1.5 text-xs">
                <b>{e.provider ?? "gateway"}</b> · {e.task} — {String(e.error).slice(0, 90)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-black", tone === "bad" && "text-destructive")}>{value}</p>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition", on ? "bg-primary" : "bg-muted")}
      aria-pressed={on}
    >
      <span className={cn("block h-5 w-5 rounded-full bg-card transition", on && "translate-x-5")} />
    </button>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="mt-3 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-32 rounded-xl bg-secondary px-2 text-sm ring-1 ring-border/60"
      />
    </label>
  );
}
