import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Users, Store, Bike, ClipboardList, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Dashboard" }] }),
  component: AdminDashboard,
});

type OrderRow = {
  id: string;
  status?: string;
  total_price?: number;
  restaurant_id?: string;
  customer_id?: string;
  created_at?: string;
};
type NamedRow = { id: string; name?: string; image_url?: string };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [users, setUsers] = useState<NamedRow[]>([]);
  const [restaurants, setRestaurants] = useState<NamedRow[]>([]);
  const [drivers, setDrivers] = useState<{ id: string }[]>([]);

  const load = useCallback(async () => {
    const [o, u, r, d] = await Promise.all([
      listTable<OrderRow>("orders", { order: "created_at.desc", limit: 500 }),
      listTable<NamedRow>("users", { limit: 1000 }),
      listTable<NamedRow>("restaurants", { limit: 500 }),
      listTable<{ id: string }>("drivers", { limit: 500 }),
    ]);
    setOrders(o); setUsers(u); setRestaurants(r); setDrivers(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const nameById = useMemo(() => {
    const m: Record<string, NamedRow> = {};
    for (const r of restaurants) m[String(r.id)] = r;
    return m;
  }, [restaurants]);

  const userById = useMemo(() => {
    const m: Record<string, NamedRow> = {};
    for (const u of users) m[String(u.id)] = u;
    return m;
  }, [users]);

  const today = dayKey(new Date());
  const todaysOrders = useMemo(
    () => orders.filter((o) => (o.created_at ?? "").slice(0, 10) === today),
    [orders, today],
  );
  const revenueToday = todaysOrders.reduce((s, o) => s + (Number(o.total_price ?? 0) || 0), 0);

  const KPIS = [
    { label: "Total users", value: users.length.toLocaleString(), icon: Users, tone: "bg-primary/10 text-primary" },
    { label: "Restaurants", value: restaurants.length.toLocaleString(), icon: Store, tone: "bg-amber-100 text-amber-700" },
    { label: "Drivers", value: drivers.length.toLocaleString(), icon: Bike, tone: "bg-sky-100 text-sky-700" },
    { label: "Orders today", value: todaysOrders.length.toLocaleString(), icon: ClipboardList, tone: "bg-violet-100 text-violet-700" },
    { label: "Revenue today", value: formatPrice(revenueToday), icon: DollarSign, tone: "bg-emerald-100 text-emerald-700" },
  ];

  // Revenue for the last 7 days (oldest → newest).
  const week = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const total = orders
        .filter((o) => (o.created_at ?? "").slice(0, 10) === key)
        .reduce((s, o) => s + (Number(o.total_price ?? 0) || 0), 0);
      days.push({ label: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()], total });
    }
    return days;
  }, [orders]);
  const weekMax = Math.max(1, ...week.map((w) => w.total));
  const wow = useMemo(() => {
    const last = week.slice(4).reduce((s, w) => s + w.total, 0);
    const prev = week.slice(0, 3).reduce((s, w) => s + w.total, 0);
    if (!prev) return null;
    return Math.round(((last - prev) / prev) * 100);
  }, [week]);

  const topRestaurants = useMemo(() => {
    const agg: Record<string, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const id = String(o.restaurant_id ?? "");
      if (!id) continue;
      agg[id] ??= { orders: 0, revenue: 0 };
      agg[id].orders += 1;
      agg[id].revenue += Number(o.total_price ?? 0) || 0;
    }
    return Object.entries(agg)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([id, v]) => ({ id, name: nameById[id]?.name ?? "Restaurant", image: nameById[id]?.image_url, ...v }));
  }, [orders, nameById]);

  const recent = orders.slice(0, 8);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Platform dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live numbers straight from the order ledger.</p>
        </div>
        <button onClick={() => void load()} className="rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border">
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-card p-16 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading live data…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${k.tone}`}>
                  <k.icon className="h-5 w-5" strokeWidth={2.4} />
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
                {wow !== null && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                    <TrendingUp className="h-3 w-3" /> {wow > 0 ? "+" : ""}{wow}%
                  </span>
                )}
              </div>
              <div className="flex h-56 items-end gap-3">
                {week.map((w, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex w-full flex-1 items-end">
                      <div className="w-full rounded-t-xl bg-primary/15" style={{ height: "100%" }} />
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-primary to-primary/70 shadow-glow"
                        style={{ height: `${Math.max(2, (w.total / weekMax) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{w.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <h2 className="font-display text-xl font-extrabold">Top restaurants</h2>
              {topRestaurants.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {topRestaurants.map((r, i) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[12px] font-bold">{i + 1}</span>
                      {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="h-10 w-10 rounded-xl bg-muted" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.orders} orders</p>
                      </div>
                      <span className="font-display text-sm font-extrabold text-primary">{formatPrice(r.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Recent orders</h2>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <DataTable
                columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time"]}
                rows={recent.map((o) => [
                  <span className="font-bold text-primary">#{String(o.id).slice(-5).toUpperCase()}</span>,
                  userById[String(o.customer_id ?? "")]?.name ?? "—",
                  nameById[String(o.restaurant_id ?? "")]?.name ?? "—",
                  <span className="font-bold">{formatPrice(Number(o.total_price ?? 0))}</span>,
                  <StatusBadge label={String(o.status ?? "PLACED")} />,
                  <span className="text-muted-foreground">
                    {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>,
                ])}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
