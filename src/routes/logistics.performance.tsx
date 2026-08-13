import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  HardDrive,
  RefreshCw,
  Server,
  Timer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarize, subscribeMetrics, clearMetrics, type PerfSummary } from "@/lib/perf-metrics";
import { assetCacheStats, clearAssetCaches, storageEstimate } from "@/lib/sw-register";
import { getSummary, dayKey, monthKey, type PeriodSummary } from "@/lib/analytics-jobs";
import { pendingNotificationCount } from "@/lib/notifications-queue";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/logistics/performance")({
  head: () => ({
    meta: [
      { title: "Scoobix Logistics · Performance" },
      { name: "description", content: "API usage, cache hit rate, slow endpoints, memory and storage for the Scoobix Logistics platform." },
    ],
  }),
  component: LogisticsPerformance,
});

const WINDOWS = [
  { label: "5 min", ms: 5 * 60_000 },
  { label: "1 hr", ms: 60 * 60_000 },
  { label: "24 hr", ms: 24 * 60 * 60_000 },
] as const;

function pctText(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-primary"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={cn("mt-2 font-display text-2xl font-extrabold leading-none", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LogisticsPerformance() {
  const [windowMs, setWindowMs] = useState<number>(WINDOWS[1].ms);
  const [tick, setTick] = useState(0);
  const [assets, setAssets] = useState<{ caches: number; entries: number }>({ caches: 0, entries: 0 });
  const [quota, setQuota] = useState<{ usedMb: number; quotaMb: number } | null>(null);
  const [daily, setDaily] = useState<PeriodSummary | null>(null);
  const [monthly, setMonthly] = useState<PeriodSummary | null>(null);

  const summary: PerfSummary = useMemo(() => summarize(windowMs), [windowMs, tick]);

  useEffect(() => {
    const off = subscribeMetrics(() => setTick((t) => t + 1));
    return () => { off(); };
  }, []);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
    void assetCacheStats().then(setAssets);
    void storageEstimate().then(setQuota);
  }, []);

  useEffect(() => {
    refresh();
    void getSummary("daily").then(setDaily);
    void getSummary("monthly").then(setMonthly);
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const failTone = summary.failureRate > 0.05 ? "bad" : summary.failureRate > 0.01 ? "warn" : "good";
  const dbTone = summary.apiP95Ms > 1200 ? "bad" : summary.apiP95Ms > 600 ? "warn" : "good";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Performance &amp; Cost</h1>
          <p className="text-sm text-muted-foreground">Live platform telemetry.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-secondary p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setWindowMs(w.ms)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                  windowMs === w.ms ? "bg-card shadow-soft" : "text-muted-foreground",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Server} label="API requests" value={String(summary.apiCalls)} hint={`${summary.apiCached} served from cache`} />
        <Stat icon={Database} label="Cache hit rate" value={pctText(summary.apiCacheRate)} tone={summary.apiCacheRate > 0.4 ? "good" : "warn"} hint="Reads avoided on the backend" />
        <Stat icon={Timer} label="DB query time" value={`${summary.apiAvgMs} ms`} tone={dbTone} hint={`p95 ${summary.apiP95Ms} ms`} />
        <Stat icon={AlertTriangle} label="Failed requests" value={String(summary.failed)} tone={failTone} hint={pctText(summary.failureRate) + " of all traffic"} />
        <Stat icon={Activity} label="Memory" value={summary.memoryMb != null ? `${summary.memoryMb} MB` : "n/a"} />
        <Stat
          icon={HardDrive}
          label="Storage"
          value={quota ? `${quota.usedMb} MB` : `${summary.storageKb} KB`}
          hint={quota ? `quota ${quota.quotaMb} MB · ${assets.entries} cached assets` : `${assets.entries} cached assets`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> Slow endpoints (&gt;800 ms)
          </h2>
          {summary.slowest.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing slow in this window.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.slowest.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-[12px] font-bold text-amber-600">{s.ms} ms · {s.calls}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Server className="h-3.5 w-3.5" /> Busiest endpoints
          </h2>
          {summary.topEndpoints.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No traffic recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.topEndpoints.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">{s.calls} calls · {s.avgMs} ms avg</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
