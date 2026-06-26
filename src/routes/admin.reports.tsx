import { createFileRoute } from "@tanstack/react-router";
import { formatPrice } from "@/lib/format";
import { TrendingUp, Users, ShoppingBag, Download } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Cravio Admin · Reports" }] }),
  component: AdminReports,
});

function AdminReports() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Business analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Trends, cohorts and exportable reports.</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { icon: TrendingUp, label: "Gross revenue · 30d", value: formatPrice(2_842_180), delta: "+11.4%" },
          { icon: Users, label: "Active users · 30d", value: "42,318", delta: "+8.6%" },
          { icon: ShoppingBag, label: "Avg order value", value: formatPrice(28.4), delta: "+2.1%" },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <k.icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600">{k.delta}</span>
            </div>
            <p className="mt-4 font-display text-3xl font-extrabold tracking-tight">{k.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <h2 className="font-display text-xl font-extrabold">Monthly revenue</h2>
        <div className="mt-6 flex h-64 items-end gap-3">
          {[55, 62, 71, 68, 78, 84, 79, 88, 92, 96, 88, 105].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <div className="w-full rounded-t-xl bg-primary/15" style={{ height: "100%" }} />
                <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-primary to-primary/70" style={{ height: `${h}%` }} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">{["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][i]}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <h2 className="font-display text-lg font-extrabold">Top cuisines</h2>
          <ul className="mt-4 space-y-3">
            {[
              { name: "Italian", pct: 28 }, { name: "Japanese", pct: 22 },
              { name: "Indian", pct: 18 }, { name: "American", pct: 16 }, { name: "Mexican", pct: 9 },
            ].map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex justify-between text-sm font-medium">
                  <span>{c.name}</span><span className="text-muted-foreground">{c.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct * 3}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <h2 className="font-display text-lg font-extrabold">Saved reports</h2>
          <ul className="mt-4 space-y-3">
            {["Weekly executive summary", "Restaurant performance · Q3", "Driver utilisation", "Refunds & disputes", "Marketing attribution"].map((r) => (
              <li key={r} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                <span className="text-sm font-medium">{r}</span>
                <button className="text-[11px] font-bold text-primary">Open</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
