import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, ClipboardList, Map as MapIcon, Navigation, AlertTriangle, Loader2, TrendingUp, Search } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";

export const Route = createFileRoute("/logistics/")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Dashboard" }] }),
  component: LogisticsDashboard,
});

function LogisticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    riders: { total: 0, online: 0, available: 0, busy: 0, offline: 0 },
    orders: { active: 0, searching: 0, pending: 0, assigned: 0, accepted: 0, pickedUp: 0, outForDelivery: 0 },
    zones: { total: 0, active: 0 },
    alerts: 0
  });

  const version = useTableVersion(["orders", "drivers", "delivery_zones"]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, d, z] = await Promise.all([
        listTable<any>("orders", { limit: 1000 }),
        listTable<any>("drivers", { limit: 500 }),
        listTable<any>("delivery_zones", { limit: 100 }),
      ]);

      const riders = {
        total: d.length,
        online: d.filter(r => r.online_status).length,
        available: d.filter(r => r.online_status && !r.current_order_id).length,
        busy: d.filter(r => r.current_order_id).length,
        offline: d.filter(r => !r.online_status).length
      };

      const orders = {
        active: o.filter(ord => !["DELIVERED", "CANCELLED"].includes(ord.status)).length,
        searching: o.filter(ord => ord.status === "PLACED").length,
        pending: o.filter(ord => ord.status === "ACCEPTED").length,
        assigned: o.filter(ord => ord.status === "READY").length,
        accepted: o.filter(ord => ord.status === "ACCEPTED").length,
        pickedUp: o.filter(ord => ord.status === "PICKED_UP").length,
        outForDelivery: o.filter(ord => ord.status === "ON_THE_WAY").length
      };

      setStats({
        riders,
        orders,
        zones: { total: z.length, active: z.filter(zone => zone.active).length },
        alerts: o.filter(ord => ord.status === "PLACED" && (Date.now() - new Date(ord.created_at).getTime() > 300000)).length
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const KPIS = [
    { label: "Active Deliveries", value: stats.orders.active, icon: Truck, tone: "bg-sky-100 text-sky-600" },
    { label: "Online Riders", value: stats.riders.online, icon: Bike, tone: "bg-emerald-100 text-emerald-600" },
    { label: "Unassigned Orders", value: stats.orders.searching, icon: Navigation, tone: "bg-amber-100 text-amber-600" },
    { label: "Operational Alerts", value: stats.alerts, icon: AlertTriangle, tone: stats.alerts > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Operations Overview</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground">Logistics Command</h1>
        </div>
        <button onClick={load} className="rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border transition hover:bg-muted">
          Refresh Live Data
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-card p-16 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> Connecting to logistics engine…
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60 transition hover:shadow-glow/5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${k.tone}`}>
                  <k.icon className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <p className="mt-3 font-display text-2xl font-extrabold tracking-tight">{k.value}</p>
                <p className="text-[12px] font-medium text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
                <Bike className="h-5 w-5 text-sky-600" />
                Rider Fleet Status
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-slate-900">{stats.riders.available}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-slate-900">{stats.riders.busy}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Busy / En Route</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-slate-900">{stats.riders.offline}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Offline</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-slate-900">{stats.riders.total}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Total Registered</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-sky-600" />
                Order Lifecycle
              </h2>
              <div className="mt-6 space-y-3">
                {[
                  { label: "Searching for Rider", count: stats.orders.searching, color: "bg-rose-500" },
                  { label: "Accepted by Rider", count: stats.orders.accepted, color: "bg-sky-500" },
                  { label: "At Pickup / Preparing", count: stats.orders.assigned, color: "bg-amber-500" },
                  { label: "Out for Delivery", count: stats.orders.outForDelivery, color: "bg-emerald-500" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm font-black">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Truck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
