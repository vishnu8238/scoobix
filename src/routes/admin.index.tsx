import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Users, Store, Bike, ClipboardList, DollarSign, TrendingUp, Loader2, Map as MapIcon, ShieldAlert, LifeBuoy, AlertTriangle } from "lucide-react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { getZoneStats } from "@/lib/zones-api";
import { computeSupportAnalytics, listAllTickets, listTicketRatings } from "@/lib/support-api";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Scoobix Master Admin · Command Center" }] }),
  component: AdminDashboard,
});

type OrderRow = {
  id: string;
  status?: string;
  total_price?: number;
  restaurant_id?: string;
  customer_id?: string;
  created_at?: string;
  driver_id?: string;
};
type NamedRow = { id: string; name?: string; image_url?: string };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [users, setUsers] = useState<NamedRow[]>([]);
  const [restaurants, setRestaurants] = useState<NamedRow[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [zoneStats, setZoneStats] = useState<any>(null);
  const [supportStats, setSupportStats] = useState<any>(null);

  const version = useTableVersion(["orders", "users", "restaurants", "drivers", "support_tickets"]);

  const load = useCallback(async () => {
    const [o, u, r, d, z, tickets, ratings] = await Promise.all([
      listTable<OrderRow>("orders", { order: "created_at.desc", limit: 500 }),
      listTable<NamedRow>("users", { limit: 1000 }),
      listTable<NamedRow>("restaurants", { limit: 500 }),
      listTable<any>("drivers", { limit: 500 }),
      getZoneStats(),
      listAllTickets(),
      listTicketRatings()
    ]);
    
    setOrders(o); 
    setUsers(u); 
    setRestaurants(r); 
    setDrivers(d);
    setZoneStats(z);
    setSupportStats(computeSupportAnalytics(tickets, ratings));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

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
    { label: "Total Orders", value: orders.length.toLocaleString(), icon: ClipboardList, tone: "bg-primary/10 text-primary" },
    { label: "Pending Orders", value: orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status || "")).length, icon: Loader2, tone: "bg-amber-100 text-amber-700" },
    { label: "Unassigned", value: orders.filter(o => !o.driver_id && !["DELIVERED", "CANCELLED"].includes(o.status || "")).length, icon: ShieldAlert, tone: "bg-rose-100 text-rose-700" },
    { label: "Active Partners", value: zoneStats?.activeRiders ?? 0, icon: Bike, tone: "bg-sky-100 text-sky-700" },
    { label: "Open Tickets", value: supportStats?.open ?? 0, icon: LifeBuoy, tone: "bg-violet-100 text-violet-700" },
    { label: "Revenue Today", value: formatPrice(revenueToday), icon: DollarSign, tone: "bg-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operational Control Center</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Platform overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time logistics and business metrics.</p>
        </div>
        <button onClick={() => void load()} className="rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border">
          Refresh Live Data
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-card p-16 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading command center…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
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
                  <h2 className="font-display text-xl font-extrabold">Zone Supply & Demand</h2>
                  <p className="text-xs text-muted-foreground">Live rider availability across zones</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <TrendingUp className="h-3 w-3" /> Live
                </span>
              </div>
              <div className="space-y-4">
                 <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/30">
                       <p className="text-[10px] font-bold uppercase text-muted-foreground">Available Riders</p>
                       <p className="text-2xl font-black">{zoneStats?.availableRiders ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30">
                       <p className="text-[10px] font-bold uppercase text-muted-foreground">Busy Riders</p>
                       <p className="text-2xl font-black">{zoneStats?.busyRiders ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30">
                       <p className="text-[10px] font-bold uppercase text-muted-foreground">Offline</p>
                       <p className="text-2xl font-black">{zoneStats?.offlineRiders ?? 0}</p>
                    </div>
                 </div>
                 <div className="rounded-2xl border border-dashed border-border p-6 flex flex-col items-center justify-center text-center">
                    <MapIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-bold">Logistics Map Insight</p>
                    <p className="text-xs text-muted-foreground max-w-xs">High demand detected in central zones. Unassigned orders increasing.</p>
                 </div>
              </div>
            </section>

            <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-amber-500" /> Support Queue
              </h2>
              <div className="mt-4 space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Critical Tickets</span>
                    <span className="font-black text-rose-600">{supportStats?.overdue ?? 0}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Wait Time (Avg)</span>
                    <span className="font-black">{supportStats?.avgFirstResponseMins ?? 0}m</span>
                 </div>
                 <div className="pt-4 border-t border-border/40">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">CSAT Rating</p>
                    <p className="text-3xl font-black text-amber-500">{supportStats?.avgRating ?? "—"} <span className="text-lg">★</span></p>
                 </div>
              </div>
            </section>
          </div>

          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Real-time Order Feed</h2>
            </div>
            {orders.slice(0, 10).length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <DataTable
                columns={["Order", "Customer", "Restaurant", "Value", "Status", "Time"]}
                rows={orders.slice(0, 10).map((o) => [
                  <span key={o.id} className="font-bold text-primary">#{String(o.id).slice(-5).toUpperCase()}</span>,
                  userById[String(o.customer_id ?? "")]?.name ?? "—",
                  nameById[String(o.restaurant_id ?? "")]?.name ?? "—",
                  <span key={o.id} className="font-bold">{formatPrice(Number(o.total_price ?? 0))}</span>,
                  <StatusBadge key={o.id} label={String(o.status ?? "PLACED")} />,
                  <span key={o.id} className="text-muted-foreground">
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
