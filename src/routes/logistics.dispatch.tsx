import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Navigation, Search, Loader2, Bike, Store, MapPin, ShieldAlert, History } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { formatPrice } from "@/lib/format";
import { useTableVersion } from "@/lib/realtime-hooks";

export const Route = createFileRoute("/logistics/dispatch")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Manual Dispatch" }] }),
  component: LogisticsDispatch,
});

function LogisticsDispatch() {
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const version = useTableVersion(["orders", "drivers"]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, r] = await Promise.all([
      listTable<any>("orders", { 
        status: "in.(PLACED,CONFIRMED,ACCEPTED,PREPARING,READY)",
        order: "created_at.desc" 
      }),
      listTable<any>("drivers", { 
        online_status: "eq.true",
        limit: 100 
      })
    ]);
    setOrders(o);
    setRiders(r);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Logistics Operations</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Manual Dispatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Override assignment rules and manually allocate riders.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
         <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
               <ShieldAlert className="h-5 w-5 text-rose-500" /> Unassigned Orders
            </h2>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : orders.filter(o => !o.driver_id).length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">All orders assigned.</p>
            ) : (
              <div className="space-y-3">
                 {orders.filter(o => !o.driver_id).map(o => (
                    <div key={o.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between">
                       <div>
                          <p className="text-xs font-bold text-primary">#{o.id.slice(-5).toUpperCase()}</p>
                          <p className="text-sm font-black">{o.restaurant_name || "Restaurant"}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                             <MapPin className="h-2.5 w-2.5" /> {o.delivery_address || "No address"}
                          </p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black">{formatPrice(o.total_price)}</p>
                          <button className="mt-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground">Assign</button>
                       </div>
                    </div>
                 ))}
              </div>
            )}
         </section>

         <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
               <Bike className="h-5 w-5 text-emerald-500" /> Available Riders
            </h2>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : riders.filter(r => !r.current_order_id).length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">No available riders online.</p>
            ) : (
              <div className="space-y-3">
                 {riders.filter(r => !r.current_order_id).map(r => (
                    <div key={r.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                             <Bike className="h-4 w-4" />
                          </div>
                          <div>
                             <p className="text-sm font-black">{r.name || "Rider"}</p>
                             <p className="text-[10px] text-muted-foreground">{r.vehicle_type || "Vehicle"} · {r.id.slice(-5)}</p>
                          </div>
                       </div>
                       <button className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold">Select</button>
                    </div>
                 ))}
              </div>
            )}
         </section>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
         <h2 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" /> Dispatch History (Recent)
         </h2>
         <DataTable 
            columns={["Order", "Rider", "Admin", "Status", "Time"]}
            rows={orders.filter(o => o.driver_id).slice(0, 5).map(o => [
               <span key={o.id+"o"} className="font-bold text-xs">#{o.id.slice(-5)}</span>,
               <span key={o.id+"r"} className="text-xs font-medium">{o.driver_name || "Assigned"}</span>,
               <span key={o.id+"a"} className="text-xs text-muted-foreground">System</span>,
               <StatusBadge key={o.id+"s"} label={o.status} />,
               <span key={o.id+"t"} className="text-[10px] text-muted-foreground">{new Date(o.updated_at || o.created_at).toLocaleTimeString()}</span>
            ])}
         />
      </section>
    </div>
  );
}
