import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, IndianRupee, ShoppingBag, Star, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/partner/analytics")({
  head: () => ({ meta: [{ title: "Cravio Partner · Sales analytics" }] }),
  component: AnalyticsPage,
});

const STATS = [
  { label: "Sales today",  value: 18_440, growth: 12.3, icon: IndianRupee },
  { label: "Orders today", value: 38,     growth: 6.4,  icon: ShoppingBag, isCount: true },
  { label: "Avg ticket",   value: 485,    growth: 3.1,  icon: TrendingUp },
  { label: "Rating",       value: 4.8,    growth: 0.2,  icon: Star, isRating: true },
];

const WEEKLY = [
  { d: "Mon", v: 28 }, { d: "Tue", v: 36 }, { d: "Wed", v: 41 },
  { d: "Thu", v: 52 }, { d: "Fri", v: 68 }, { d: "Sat", v: 78 }, { d: "Sun", v: 64 },
];

function AnalyticsPage() {
  const max = Math.max(...WEEKLY.map((w) => w.v));
  const topItems = [
    { name: "Truffle Carbonara", sold: 84, revenue: 124_320 },
    { name: "Margherita Verace", sold: 72, revenue: 80_640 },
    { name: "Burrata & Heirloom", sold: 51, revenue: 48_960 },
    { name: "Tiramisu Classico",  sold: 47, revenue: 31_960 },
  ];

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Sales analytics" subtitle="Last 7 days" />

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-soft text-primary"><s.icon className="h-4 w-4" strokeWidth={2.5} /></span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight className="h-3 w-3" />{s.growth}%</span>
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold">
              {s.isRating ? s.value : s.isCount ? s.value : formatPrice(s.value)}
            </p>
          </div>
        ))}
      </div>

      <section className="mx-4 mt-6 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Orders this week</h3>
        <div className="mt-4 flex h-40 items-end gap-3">
          {WEEKLY.map((w) => (
            <div key={w.d} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t-lg gradient-primary transition-all" style={{ height: `${(w.v / max) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{w.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-6 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Top selling items</h3>
        <ul className="mt-3 divide-y divide-border/60">
          {topItems.map((t, i) => (
            <li key={t.name} className="flex items-center gap-3 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-[12px] font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.sold} sold</div>
              </div>
              <div className="text-sm font-bold">{formatPrice(t.revenue)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
