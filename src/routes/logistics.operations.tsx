import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Gauge, Loader2, Search, Filter, ArrowUpRight, Bike, Store, ClipboardList } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/logistics/operations")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Live Operations" }] }),
  component: LogisticsOperations,
});

type OpStats = {
  active_orders: number;
  unassigned_orders: number;
  online_riders: number;
  delayed_orders: number;
};

function LogisticsOperations() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<OpStats>({
    active_orders: 0,
    unassigned_orders: 0,
    online_riders: 0,
    delayed_orders: 0,
  });
  const [q, setQ] = useState("");
  const version = useTableVersion(["orders", "drivers"]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, d] = await Promise.all([
      listTable("orders", { order: "created_at.desc", limit: 100 }),
      listTable("drivers", { online_status: "eq.true", limit: 500 }),
    ]);

    const active = o.filter((x: any) => !["DELIVERED", "CANCELLED"].includes(x.status));
    setOrders(active);
    setStats({
      active_orders: active.length,
      unassigned_orders: active.filter((x: any) => !x.driver_id).length,
      online_riders: d.length,
      delayed_orders: active.filter((x: any) => {
        const created = new Date(x.created_at).getTime();
        return Date.now() - created > 45 * 60 * 1000; // 45 mins
      }).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Gauge className="h-6 w-6 text-primary" /> Live Operations
          </h1>
          <p className="text-sm text-muted-foreground">Real-time pulse of the delivery network.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active Orders" value={stats.active_orders} icon={ClipboardList} tone="primary" />
        <StatCard label="Unassigned" value={stats.unassigned_orders} icon={Filter} tone="warn" />
        <StatCard label="Online Riders" value={stats.online_riders} icon={Bike} tone="success" />
        <StatCard label="Delayed (>45m)" value={stats.delayed_orders} icon={ArrowUpRight} tone="danger" />
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search active orders..."
              className="w-full rounded-2xl bg-muted/40 py-2 pl-10 pr-4 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <DataTable 
            columns={["Order", "Status", "Rider", "Restaurant", "Value", "Age"]}
            rows={orders.filter(o => String(o.id).includes(q)).map(o => {
              const age = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
              return [
                <span key={o.id} className="font-bold text-primary">#{o.id.slice(-5).toUpperCase()}</span>,
                <StatusBadge key={o.id+"s"} label={o.status} />,
                <span key={o.id+"r"} className="text-muted-foreground">{o.driver_id ? "Assigned" : "Searching..."}</span>,
                <span key={o.id+"rs"} className="text-muted-foreground">{o.restaurant_id?.slice(0,8) || "—"}</span>,
                <span key={o.id+"v"} className="font-bold">{formatPrice(o.total_price)}</span>,
                <span key={o.id+"a"} className={age > 45 ? "font-bold text-rose-600" : "text-muted-foreground"}>{age}m</span>
              ];
            })}
          />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const tones: any = {
    primary: "bg-primary/10 text-primary",
    warn: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-rose-100 text-rose-700"
  };
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
