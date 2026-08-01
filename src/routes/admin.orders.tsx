import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Orders" }] }),
  component: AdminOrders,
});

type OrderRow = {
  id: string;
  status?: string;
  total_price?: number;
  restaurant_id?: string;
  customer_id?: string;
  created_at?: string;
};
type NamedRow = { id: string; name?: string };

const IN_PROGRESS = ["PLACED", "CONFIRMED", "ACCEPTED", "PREPARING", "READY", "ASSIGNING", "ASSIGNED", "AT_PICKUP", "PICKED_UP", "ON_THE_WAY", "ARRIVED"];

function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [restaurants, setRestaurants] = useState<NamedRow[]>([]);
  const [users, setUsers] = useState<NamedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const version = useTableVersion(["orders"]);

  const load = useCallback(async () => {
    const [o, r, u] = await Promise.all([
      listTable<OrderRow>("orders", { order: "created_at.desc", limit: 300 }),
      listTable<NamedRow>("restaurants", { limit: 500 }),
      listTable<NamedRow>("users", { limit: 1000 }),
    ]);
    setOrders(o); setRestaurants(r); setUsers(u); setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const nameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [String(r.id), r.name ?? "—"])), [restaurants]);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [String(u.id), u.name ?? "—"])), [users]);

  const today = new Date().toISOString().slice(0, 10);
  const status = (o: OrderRow) => String(o.status ?? "PLACED").toUpperCase();

  const stats = useMemo(() => {
    const todays = orders.filter((o) => (o.created_at ?? "").slice(0, 10) === today);
    return [
      { key: "ALL", label: "Placed today", value: todays.length },
      { key: "PROGRESS", label: "In progress", value: orders.filter((o) => IN_PROGRESS.includes(status(o))).length },
      { key: "DELIVERED", label: "Completed", value: orders.filter((o) => status(o) === "DELIVERED").length },
      { key: "CANCELLED", label: "Cancelled", value: orders.filter((o) => status(o) === "CANCELLED").length },
    ];
  }, [orders, today]);

  const visible = useMemo(() => {
    if (filter === "ALL") return orders;
    if (filter === "PROGRESS") return orders.filter((o) => IN_PROGRESS.includes(status(o)));
    return orders.filter((o) => status(o) === filter);
  }, [orders, filter]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Orders</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Live order ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor every order across the platform in real time.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-3xl p-5 text-left shadow-soft ring-1 transition ${filter === s.key ? "bg-primary/5 ring-primary/40" : "bg-card ring-border/60"}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{s.value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No orders in this view.</p>
        ) : (
          <DataTable
            columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time"]}
            rows={visible.map((o) => [
              <span className="font-bold text-primary">#{String(o.id).slice(-5).toUpperCase()}</span>,
              userById[String(o.customer_id ?? "")] ?? "—",
              nameById[String(o.restaurant_id ?? "")] ?? "—",
              <span className="font-bold">{formatPrice(Number(o.total_price ?? 0))}</span>,
              <StatusBadge label={status(o)} />,
              <span className="text-muted-foreground">
                {o.created_at ? new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>,
            ])}
          />
        )}
      </section>
    </div>
  );
}
