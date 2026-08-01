/**
 * Shared analytics building blocks (KPI cards, charts, heatmap, leaderboards,
 * insights, range picker and export bar). Styling follows the existing Scoobix
 * card language — no redesign, just reusable pieces.
 */
import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { HeatCell, Kpi, Range, Rank, Trend } from "@/lib/analytics-api";
import { RANGE_PRESETS, customRange } from "@/lib/analytics-api";
import { exportReport, type ExportTable } from "@/lib/export-utils";

export function kpiValue(k: Kpi): string {
  if (k.kind === "money") return formatPrice(k.value);
  if (k.kind === "percent") return `${k.value}%`;
  if (k.kind === "time") return `${Math.round(k.value)} min`;
  return Number.isInteger(k.value) ? String(k.value) : k.value.toFixed(1);
}

export function KpiGrid({ kpis, columns = 4 }: { kpis: Kpi[]; columns?: 2 | 3 | 4 }) {
  const cls = columns === 2 ? "grid-cols-2" : columns === 3 ? "sm:grid-cols-3 grid-cols-2" : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-3 ${cls}`}>
      {kpis.map((k) => (
        <div key={k.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{k.label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{kpiValue(k)}</p>
          {k.delta !== undefined && (
            <p className={`mt-1 text-[11px] font-bold ${k.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {k.delta >= 0 ? "+" : ""}{k.delta}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-extrabold">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const axis = { stroke: "currentColor", fontSize: 10, opacity: 0.55 } as const;

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 14,
      border: "1px solid hsl(var(--border))",
      background: "hsl(var(--card))",
      fontSize: 12,
      color: "hsl(var(--foreground))",
    },
  };
}

export function TrendChart({
  title, data, kind = "area", money = false, height = 220, action,
}: { title: string; data: Trend[]; kind?: "area" | "bar" | "line"; money?: boolean; height?: number; action?: React.ReactNode }) {
  const fmt = (v: number) => (money ? formatPrice(v) : String(v));
  return (
    <Card title={title} action={action}>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ height }} className="text-muted-foreground">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number) => fmt(v)} {...tooltipStyle()} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            ) : kind === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number) => fmt(v)} {...tooltipStyle()} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            ) : (
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="scx-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: number) => fmt(v)} {...tooltipStyle()} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#scx-area)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function DistributionChart({ title, data, money = false }: { title: string; data: Rank[]; money?: boolean }) {
  return (
    <Card title={title}>
      {data.length === 0 ? <EmptyState /> : (
        <div style={{ height: Math.max(180, data.length * 32) }} className="text-muted-foreground">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis type="number" tick={axis} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={axis} width={110} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => (money ? formatPrice(v) : String(v))} {...tooltipStyle()} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {data.map((d, i) => (
                  <Cell key={d.id} fill="hsl(var(--primary))" fillOpacity={1 - i * 0.08} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Heatmap({ title, data }: { title: string; data: HeatCell[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const at = (day: number, hour: number) => data.find((d) => d.day === day && d.hour === hour)?.value ?? 0;
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <div className="min-w-[520px] space-y-1">
          {DAYS.map((label, day) => (
            <div key={label} className="flex items-center gap-1">
              <span className="w-8 shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
              {Array.from({ length: 24 }, (_, hour) => {
                const v = at(day, hour);
                return (
                  <div
                    key={hour}
                    title={`${label} ${String(hour).padStart(2, "0")}:00 · ${v}`}
                    className="h-4 flex-1 rounded-[3px] bg-primary"
                    style={{ opacity: v ? 0.15 + (v / max) * 0.85 : 0.06 }}
                  />
                );
              })}
            </div>
          ))}
          <div className="flex gap-1 pl-9 pt-1">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="flex-1 text-center text-[8px] font-semibold text-muted-foreground">
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function Leaderboard({
  title, rows, money = false, secondaryLabel,
}: { title: string; rows: Rank[]; money?: boolean; secondaryLabel?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card title={title}>
      {rows.length === 0 ? <EmptyState /> : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id + i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">{i + 1}</span>
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="shrink-0 font-bold">
                  {money ? formatPrice(r.value) : r.value}
                  {r.secondary !== undefined && (
                    <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                      {secondaryLabel ? `${r.secondary} ${secondaryLabel}` : r.secondary}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function DataTable({ title, columns, rows }: { title: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <EmptyState /> : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {columns.map((c) => <th key={c.key} className="px-2 pb-2">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border/60">
                  {columns.map((c) => <td key={c.key} className="px-2 py-2 font-medium">{String(r[c.key] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function InsightsCard({ insights }: { insights: string[] }) {
  if (!insights.length) return null;
  return (
    <section className="rounded-3xl bg-primary-soft/60 p-5 ring-1 ring-primary/15">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-primary">
        <Lightbulb className="h-4 w-4" /> Insights
      </h3>
      <ul className="mt-3 space-y-2">
        {insights.map((t) => (
          <li key={t} className="flex gap-2 text-sm font-medium leading-snug">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmptyState({ label = "No data for this period yet" }: { label?: string }) {
  return <p className="py-8 text-center text-sm font-medium text-muted-foreground">{label}</p>;
}

export function AnalyticsToolbar({
  range, onRange, onRefresh, loading, tables, filename,
}: {
  range: Range;
  onRange: (r: Range) => void;
  onRefresh: () => void;
  loading?: boolean;
  tables: ExportTable[];
  filename: string;
}) {
  const [custom, setCustom] = useState({ from: "", to: "" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-2xl bg-muted/60 p-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onRange(p.build())}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              range.label === p.label ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-2xl bg-muted/60 px-2 py-1">
        <input
          type="date" value={custom.from} aria-label="From date"
          onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
          className="bg-transparent text-xs font-semibold outline-none"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <input
          type="date" value={custom.to} aria-label="To date"
          onChange={(e) => {
            const to = e.target.value;
            setCustom((c) => ({ ...c, to }));
            if (custom.from && to) onRange(customRange(custom.from, to));
          }}
          className="bg-transparent text-xs font-semibold outline-none"
        />
      </div>

      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-2xl bg-card px-3 py-2 text-xs font-bold shadow-soft ring-1 ring-border"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
      </button>

      <div className="ml-auto flex items-center gap-1">
        {(["csv", "excel", "pdf"] as const).map((f) => (
          <button
            key={f}
            onClick={() => exportReport(f, tables, filename, `${range.label} · generated ${new Date().toLocaleString()}`)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-card px-3 py-2 text-xs font-bold uppercase shadow-soft ring-1 ring-border"
          >
            <Download className="h-3.5 w-3.5" /> {f}
          </button>
        ))}
      </div>
    </div>
  );
}
