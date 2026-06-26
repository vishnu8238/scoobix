import type { ReactNode } from "react";

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {columns.map((c) => <th key={c} className="py-3 pr-4">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0 transition hover:bg-muted/30">
              {r.map((cell, j) => <td key={j} className="py-3.5 pr-4">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE: Record<string, string> = {
  Delivered: "bg-emerald-100 text-emerald-700",
  Active: "bg-emerald-100 text-emerald-700",
  Settled: "bg-emerald-100 text-emerald-700",
  Online: "bg-emerald-100 text-emerald-700",
  "On the way": "bg-sky-100 text-sky-700",
  Preparing: "bg-amber-100 text-amber-700",
  Pending: "bg-amber-100 text-amber-700",
  Placed: "bg-violet-100 text-violet-700",
  Cancelled: "bg-rose-100 text-rose-700",
  Suspended: "bg-rose-100 text-rose-700",
  Offline: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE[label] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}
