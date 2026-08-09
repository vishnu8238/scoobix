import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Search, Map as MapIcon, Users, Bike, ClipboardList, ShieldAlert, Check, 
  X, Loader2, BarChart3, Clock, TrendingUp, Filter, Calendar, MapPin, 
  AlertTriangle, ArrowRight, Package, Home, Store, User
} from "lucide-react";
import { format } from "date-fns";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { GoogleMap as GoogleMap } from "@/components/maps/GoogleMap";
import { 
  fetchZones, fetchSubzones, getZoneStats, fetchZoneOrderBreakdown, 
  fetchZoneDemandAnalytics, type DeliveryZone, type Subzone 
} from "@/lib/zones-api";
import { fetchLiveShipmentOrders } from "@/lib/operations-api";
import { useTableVersion } from "@/lib/realtime-hooks";
import { OrderShipmentTimeline } from "@/components/cravio/OrderShipmentTimeline";
import { TrendChart, KpiGrid, Heatmap, Leaderboard } from "@/components/analytics/AnalyticsKit";
import { cn, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/operations")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Live Operations & Shipments" }] }),
  component: AdminOperationsDashboard,
});

function AdminOperationsDashboard() {
  const [activeTab, setActiveTab] = useState<"zones" | "shipments" | "map">("zones");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSubzoneId, setSelectedSubzoneId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const version = useTableVersion(["delivery_zones", "orders", "drivers", "delivery_subzones"]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [z, sz, st, live] = await Promise.all([
        fetchZones({ city: "eq.Vadodara" }).catch(() => []),
        fetchSubzones(selectedZoneId || undefined).catch(() => []),
        getZoneStats(selectedZoneId || undefined).catch(() => ({})),
        fetchLiveShipmentOrders().catch(() => [])
      ]);
      
      setZones(z);
      setSubzones(sz);
      setStats(st);
      setShipments(live);
      
      if (selectedZoneId) {
        const [br, an] = await Promise.all([
          fetchZoneOrderBreakdown(selectedZoneId).catch(() => null),
          fetchZoneDemandAnalytics(selectedZoneId, selectedSubzoneId || undefined).catch(() => null)
        ]);
        setBreakdown(br);
        setAnalytics(an);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedZoneId, selectedSubzoneId, version]);

  useEffect(() => { void refresh(); }, [refresh]);

  const liveKpis = useMemo(() => {
    if (!shipments.length) return [];
    return [
      { label: "Total Live Orders", value: shipments.length, icon: ClipboardList, tone: "primary" },
      { label: "Assigned", value: shipments.filter(o => o.driver_id).length, icon: Bike, tone: "primary" },
      { label: "Unassigned", value: shipments.filter(o => !o.driver_id && o.status !== "CANCELLED").length, icon: ShieldAlert, tone: "rose" },
      { label: "At Pickup", value: shipments.filter(o => o.status === "AT_PICKUP").length, icon: Package, tone: "amber" },
      { label: "Out for Delivery", value: shipments.filter(o => ["PICKED_UP", "ON_THE_WAY"].includes(o.status)).length, icon: Bike, tone: "emerald" },
      { label: "Delivered", value: shipments.filter(o => o.status === "DELIVERED").length, icon: Check, tone: "emerald" },
      { label: "Cancelled", value: shipments.filter(o => o.status === "CANCELLED").length, icon: X, tone: "rose" },
    ];
  }, [shipments]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Real-time Operations</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Zone & Order Shipment</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex rounded-2xl bg-card p-1 shadow-soft ring-1 ring-border/60">
            {[
              { id: "zones", label: "Zone Operations", icon: BarChart3 },
              { id: "shipments", label: "Order Shipments", icon: ClipboardList },
              { id: "map", label: "Live Logistics Map", icon: MapIcon },
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition",
                  activeTab === t.id ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {activeTab === "zones" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 shadow-soft ring-1 ring-border/60">
                <MapPin className="h-4 w-4 text-primary" />
                <select 
                  value={selectedZoneId || ""} 
                  onChange={(e) => {
                    setSelectedZoneId(e.target.value || null);
                    setSelectedSubzoneId(null);
                  }}
                  className="bg-transparent text-sm font-bold outline-none"
                >
                  <option value="">All Zones</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
             </div>

             {selectedZoneId && subzones.length > 0 && (
               <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 shadow-soft ring-1 ring-border/60 animate-in fade-in slide-in-from-left-2">
                  <Filter className="h-4 w-4 text-primary" />
                  <select 
                    value={selectedSubzoneId || ""} 
                    onChange={(e) => setSelectedSubzoneId(e.target.value || null)}
                    className="bg-transparent text-sm font-bold outline-none"
                  >
                    <option value="">All Subzones</option>
                    {subzones.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
             )}

             <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 shadow-soft ring-1 ring-border/60">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">Today</span>
             </div>
          </div>

          {stats && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
               <KPI label="Orders" value={stats.activeOrders} icon={ClipboardList} />
               <KPI label="Available Riders" value={stats.availableRiders} icon={Check} tone="emerald" />
               <KPI label="Busy Riders" value={stats.busyRiders} icon={Loader2} tone="amber" />
               <KPI label="Unassigned" value={stats.unassignedOrders} icon={ShieldAlert} tone="rose" />
               <KPI label="Avg Delivery" value="32m" icon={Clock} />
               <KPI label="Demand" value="HIGH" icon={TrendingUp} tone="rose" />
               <KPI label="Supply" value="STABLE" icon={Check} tone="emerald" />
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-6">
                {breakdown && (
                  <TrendChart 
                    title="Hourly Order Breakdown" 
                    data={breakdown.hourly.map((h: any) => ({ label: h.label, value: h.value }))}
                    kind="bar"
                  />
                )}
                
                {analytics && (
                  <section className="grid gap-4 sm:grid-cols-2">
                    <AnalyticsCard label="Order Density" value={`${analytics.orderDensity.toFixed(1)}/km²`} />
                    <AnalyticsCard label="Cancellation Rate" value={`${analytics.cancellationRate.toFixed(1)}%`} tone="rose" />
                    <AnalyticsCard label="Avg Assignment" value={`${analytics.avgAssignmentTime}m`} />
                    <AnalyticsCard label="Avg Pickup" value={`${analytics.avgPickupTime}m`} />
                  </section>
                )}
             </div>
             
             <aside className="space-y-6">
                <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
                  <h3 className="font-display text-lg font-extrabold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Operational Alerts
                  </h3>
                  <div className="mt-4 space-y-3">
                     <AlertItem label="High demand in Alkapuri" type="warning" />
                     <AlertItem label="3 unassigned for > 10m" type="error" />
                     <AlertItem label="Rider shortage in Gotri" type="error" />
                  </div>
                </section>
                
                {stats && (
                  <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
                    <h3 className="font-display text-lg font-extrabold">Rider Supply</h3>
                    <div className="mt-4 space-y-4">
                       <SupplyRow label="Available" count={stats.availableRiders} color="bg-emerald-500" total={stats.activeRiders} />
                       <SupplyRow label="Busy" count={stats.busyRiders} color="bg-amber-500" total={stats.activeRiders} />
                    </div>
                  </section>
                )}
             </aside>
          </div>
        </div>
      )}

      {activeTab === "shipments" && (
        <div className="space-y-6">
           <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {liveKpis.map(k => (
                <KPI key={k.label} {...k} />
              ))}
           </section>

           <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60 min-w-[300px]">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    placeholder="Search by Order ID, Restaurant, Rider..."
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="flex gap-2">
                   <FilterButton label="All" active={!q} onClick={() => setQ("")} />
                   <FilterButton label="Unassigned" active={q === "unassigned"} onClick={() => setQ("unassigned")} />
                   <FilterButton label="Out for Delivery" active={q === "picked_up"} onClick={() => setQ("picked_up")} />
                </div>
              </div>

              <DataTable 
                columns={["Order", "Zone/Area", "Status Tracking", "Rider", "Metrics", "Action"]}
                rows={shipments.filter(o => {
                  const term = q.toLowerCase();
                  if (term === "unassigned") return !o.driver_id;
                  if (term === "picked_up") return o.status === "PICKED_UP";
                  return o.id.includes(term) || (o.restaurant_name || "").toLowerCase().includes(term);
                }).map(o => [
                  <div key={o.id+"id"}>
                    <p className="font-bold text-xs">#{o.id.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(o.created_at), "HH:mm")}</p>
                  </div>,
                  <div key={o.id+"area"}>
                    <p className="font-bold text-xs">{o.zone_id ? zones.find(z => z.id === o.zone_id)?.name : "General"}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{o.delivery_address}</p>
                  </div>,
                  <OrderShipmentTimeline key={o.id+"tm"} status={o.status} />,
                  <div key={o.id+"rd"}>
                    {o.driver_id ? (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary-soft grid place-items-center text-[10px] font-bold">R</div>
                        <span className="text-xs font-bold">Rider Assigned</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">Assigning...</span>
                    )}
                  </div>,
                  <div key={o.id+"mt"}>
                    <p className="text-[10px] font-bold">₹{o.total_price}</p>
                    <p className="text-[9px] text-muted-foreground">Attempt {o.offer_attempt || 1}</p>
                  </div>,
                  <button 
                    key={o.id+"btn"} 
                    onClick={() => setSelectedOrderId(o.id)}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ])}
              />
           </section>
        </div>
      )}

      {activeTab === "map" && (
        <section className="h-[700px] rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60">
           <GoogleMap 
             className="h-full w-full" 
             polygons={zones.map(z => ({
               id: z.id,
               points: z.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
               label: z.name,
               color: "var(--color-primary)"
             }))}
             markers={shipments.filter(o => o.lat && o.lng).map(o => ({
               id: o.id,
               lat: o.lat,
               lng: o.lng,
               kind: o.status === "PICKED_UP" ? "rider" : "restaurant",
               label: `#${o.id.slice(0, 8)}`
             }))}
             interactive
           />
        </section>
      )}

      {selectedOrderId && (
        <OrderDetailsModal 
          order={shipments.find(o => o.id === selectedOrderId)} 
          onClose={() => setSelectedOrderId(null)} 
        />
      )}
    </div>
  );
}

function OrderDetailsModal({ order, onClose }: { order: any; onClose: () => void }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-card rounded-3xl shadow-glow overflow-hidden animate-in fade-in zoom-in duration-200">
        <header className="flex items-center justify-between p-6 border-b border-border/60">
           <div>
             <h3 className="font-display text-xl font-extrabold">Order Shipment Details</h3>
             <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)} · {format(new Date(order.created_at), "MMM d, HH:mm")}</p>
           </div>
           <button onClick={onClose} className="h-10 w-10 grid place-items-center rounded-2xl bg-muted hover:bg-muted/80 transition">
             <X className="h-5 w-5" />
           </button>
        </header>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
           <section>
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Live Status Pipeline</h4>
             <div className="p-4 rounded-2xl bg-muted/30 ring-1 ring-border/40">
               <OrderShipmentTimeline status={order.status} />
             </div>
           </section>

           <div className="grid gap-6 md:grid-cols-2">
             <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Logistics Info</h4>
                <div className="space-y-3">
                  <InfoRow label="Restaurant" value={order.restaurant_name || "—"} icon={Store} />
                  <InfoRow label="Delivery Area" value={order.delivery_address || "—"} icon={MapPin} />
                  <InfoRow 
                    label="Rider" 
                    value={order.driver_id ? (order.driver_name || "Assigned Rider") : "Unassigned"} 
                    icon={Bike} 
                  />
                  <InfoRow label="Customer" value={order.customer_name || "Guest User"} icon={User} />
                </div>
             </section>

             <section className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assignment Performance</h4>
                <div className="space-y-3">
                  <InfoRow label="Offer Attempt" value={`${order.offer_attempt || 1}`} icon={TrendingUp} />
                  <InfoRow label="Offer Status" value={order.assignment_status || "SEARCHING"} icon={ShieldAlert} />
                  <InfoRow label="Reassignments" value={`${order.reassignment_count || 0}`} icon={Clock} />
                </div>
             </section>
           </div>

           <section className="h-[200px] rounded-2xl overflow-hidden ring-1 ring-border/60">
             <GoogleMap 
               className="h-full w-full" 
               markers={[
                 { id: "pick", lat: order.lat || 12.9716, lng: order.lng || 77.5946, kind: "restaurant" },
                 { id: "drop", lat: 12.9784, lng: 77.6408, kind: "customer" }
               ]}
               interactive={false}
             />
           </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-xl bg-muted/60 grid place-items-center text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
        <p className="text-sm font-extrabold">{value}</p>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone = "muted" }: { label: string; value: number | string; icon: any; tone?: string }) {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    zinc: "bg-zinc-100 text-zinc-700",
    muted: "bg-muted text-muted-foreground"
  };
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function AnalyticsCard({ label, value, tone = "primary" }: { label: string; value: any; tone?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className={cn("font-display font-extrabold", tone === "rose" ? "text-rose-600" : "text-primary")}>{value}</span>
    </div>
  );
}

function AlertItem({ label, type }: { label: string; type: "warning" | "error" }) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-2xl text-xs font-bold",
      type === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
    )}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function SupplyRow({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-xs font-bold transition",
        active ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
