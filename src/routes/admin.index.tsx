import { createFileRoute } from "@tanstack/react-router";
import { adminStats, adminOrdersRecent, adminRestaurants } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Users, Store, Bike, ClipboardList, DollarSign, TrendingUp, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Cravio Admin · Dashboard" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const KPIS = [
    { label: "Total users", value: adminStats.users.toLocaleString(), delta: adminStats.growth.users, icon: Users, tone: "bg-primary/10 text-primary" },
    { label: "Restaurants", value: adminStats.restaurants.toLocaleString(), delta: adminStats.growth.restaurants, icon: Store, tone: "bg-amber-100 text-amber-700" },
    { label: "Drivers", value: adminStats.drivers.toLocaleString(), delta: adminStats.growth.drivers, icon: Bike, tone: "bg-sky-100 text-sky-700" },
    { label: "Orders today", value: adminStats.ordersToday.toLocaleString(), delta: adminStats.growth.orders, icon: ClipboardList, tone: "bg-violet-100 text-violet-700" },
    { label: "Revenue today", value: formatPrice(adminStats.revenueToday), delta: adminStats.growth.revenue, icon: DollarSign, tone: "bg-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Good morning, Anika</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's how Cravio is performing today.</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border">Export</button>
          <button className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">New report</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${k.tone}`}>
                <k.icon className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                <ArrowUpRight className="h-3 w-3" /> {k.delta}%
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold tracking-tight">{k.value}</p>
            <p className="text-[12px] font-medium text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold">Revenue · last 7 days</h2>
              <p className="text-xs text-muted-foreground">Across all restaurants</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              <TrendingUp className="h-3 w-3" /> +9.1% WoW
            </span>
          </div>
          <div className="flex h-56 items-end gap-3">
            {[68, 84, 72, 91, 78, 96, 88].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-xl bg-primary/15" style={{ height: "100%" }} />
                  <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-primary to-primary/70 shadow-glow" style={{ height: `${h}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <h2 className="font-display text-xl font-extrabold">Top restaurants</h2>
          <ul className="mt-4 space-y-3">
            {adminRestaurants.slice(0, 5).map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[12px] font-bold">{i + 1}</span>
                <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.orders} orders</p>
                </div>
                <span className="font-display text-sm font-extrabold text-primary">{formatPrice(r.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Recent orders</h2>
          <button className="text-[12px] font-bold text-primary">View all</button>
        </div>
        <DataTable
          columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time"]}
          rows={adminOrdersRecent.map((o) => [
            <span className="font-bold text-primary">{o.id}</span>,
            o.customer,
            o.restaurant,
            <span className="font-bold">{formatPrice(o.total)}</span>,
            <StatusBadge label={o.status} />,
            <span className="text-muted-foreground">{o.time}</span>,
          ])}
        />
      </section>
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
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

export function StatusBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
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
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${map[label] ?? "bg-muted text-muted-foreground"}`}>{label}</span>;
}
