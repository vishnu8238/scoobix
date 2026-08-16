import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { 
  Package, Clock, CheckCircle2, XCircle, AlertCircle, 
  Search, Filter, Calendar, MapPin, TrendingUp, History
} from "lucide-react";
import { cn } from "@/lib/format";
import { useDriver } from "@/lib/driver-store";
import { useLiveData } from "@/lib/realtime-hooks";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/rider/history")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Trip History" }] }),
  component: RiderHistory,
});

const TABS = ["Deliveries", "Gigs", "Earnings"] as const;

function RiderHistory() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Deliveries");
  const { driverId } = useDriver();

  // Fetch orders for Deliveries tab
  const { data: orders, loading: ordersLoading } = useLiveData<any[]>(
    ["orders", "history"],
    () => driverId ? listTable("orders", { 
      driver_id: `eq.${driverId}`, 
      status: "in.(DELIVERED,CANCELLED,FAILED)",
      order: "created_at.desc"
    }) : Promise.resolve([]),
    [driverId]
  );

  // Fetch gigs for Gigs tab
  const { data: gigs, loading: gigsLoading } = useLiveData<any[]>(
    ["rider_gig_enrollments", "history"],
    () => driverId ? listTable("rider_gig_enrollments", { 
      rider_id: `eq.${driverId}`,
      order: "created_at.desc"
    }) : Promise.resolve([]),
    [driverId]
  );

  return (
    <div className="w-full min-h-svh pb-8 px-4 pt-7 animate-fade-up">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <History className="h-4 w-4" />
          <p className="eyebrow">History</p>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Your Activity</h1>
      </header>

      <div className="flex gap-2 rounded-full bg-muted/50 p-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2 text-[10px] font-black uppercase tracking-widest transition",
              tab === t ? "bg-card text-primary shadow-soft ring-1 ring-border/60" : "text-muted-foreground",
            )}
          >{t}</button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === "Deliveries" && (
          <div className="space-y-3">
             {ordersLoading ? (
               <div className="py-12 text-center text-xs text-muted-foreground">Loading history...</div>
             ) : orders?.length === 0 ? (
               <div className="py-12 text-center">
                 <Package className="h-10 w-10 mx-auto text-muted/40 mb-3" />
                 <p className="text-xs text-muted-foreground">No completed deliveries yet.</p>
               </div>
             ) : (
               orders?.map((o) => (
                 <div key={o.id} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                        o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {o.status}
                      </span>
                   </div>
                   <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                         <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold truncate">{o.delivery_address || "Unnamed Location"}</p>
                         <p className="text-[10px] text-muted-foreground">Order #{o.id.slice(-6).toUpperCase()}</p>
                      </div>
                      <p className="font-display text-sm font-black">₹{o.total_price || 0}</p>
                   </div>
                 </div>
               ))
             )}
          </div>
        )}

        {tab === "Gigs" && (
           <div className="space-y-3">
             {gigsLoading ? (
               <div className="py-12 text-center text-xs text-muted-foreground">Loading gigs...</div>
             ) : gigs?.length === 0 ? (
               <div className="py-12 text-center">
                 <Calendar className="h-10 w-10 mx-auto text-muted/40 mb-3" />
                 <p className="text-xs text-muted-foreground">No gig bookings found.</p>
               </div>
             ) : (
               gigs?.map((g) => (
                 <div key={g.id} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-xs font-bold">Shift Booking</p>
                       <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">Confirmed</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(g.created_at).toLocaleString()}</p>
                 </div>
               ))
             )}
           </div>
        )}

        {tab === "Earnings" && (
           <div className="py-12 text-center">
              <TrendingUp className="h-10 w-10 mx-auto text-muted/40 mb-3" />
              <p className="text-xs text-muted-foreground">Detailed earnings history is available on the Earnings tab.</p>
              <button 
                onClick={() => setTab("Deliveries")}
                className="mt-4 text-[10px] font-black text-primary uppercase tracking-widest"
              >Back to Deliveries</button>
           </div>
        )}
      </div>
    </div>
  );
}
