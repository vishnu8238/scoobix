import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Search, Plus, Map as MapIcon, Layers, Users, Store, Bike, ClipboardList, Shield, ShieldAlert, Ban, Check, Edit2, Trash2, ChevronRight, X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { LeafletMap } from "@/components/cravio/LeafletMap";
import { fetchZones, fetchSubzones, createZone, updateZone, deleteZone, createSubzone, updateSubzone, deleteSubzone, getZoneStats, type DeliveryZone, type Subzone } from "@/lib/zones-api";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/live")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Zones & Delivery Management" }] }),
  component: AdminZonesDashboard,
});

function AdminZonesDashboard() {
  const [view, setView] = useState<"list" | "map" | "detail">("list");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  
  const version = useTableVersion(["delivery_zones", "delivery_subzones", "drivers", "orders"]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [z, sz, st] = await Promise.all([
      fetchZones(),
      fetchSubzones(),
      getZoneStats()
    ]);
    setZones(z);
    setSubzones(sz);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, version]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return zones.filter(z => 
      z.name.toLowerCase().includes(term) || 
      z.city.toLowerCase().includes(term)
    );
  }, [zones, q]);

  if (view === "detail" && selectedZoneId) {
    const zone = zones.find(z => z.id === selectedZoneId);
    if (zone) return <ZoneDetailView zone={zone} subzones={subzones.filter(s => s.zone_id === zone.id)} onBack={() => setView("list")} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Delivery Infrastructure</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Zones & Logistics</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl bg-card p-1 shadow-soft ring-1 ring-border/60">
            <button 
              onClick={() => setView("list")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${view === "list" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
            >
              List View
            </button>
            <button 
              onClick={() => setView("map")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${view === "map" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
            >
              Live Map
            </button>
          </div>
          <button className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
            <Plus className="h-4 w-4" /> Create Zone
          </button>
        </div>
      </header>

      {stats && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
           <KPI label="Total Riders" value={stats.totalRiders} icon={Users} />
           <KPI label="Active" value={stats.activeRiders} icon={Bike} tone="primary" />
           <KPI label="Available" value={stats.availableRiders} icon={Check} tone="emerald" />
           <KPI label="Busy" value={stats.busyRiders} icon={Loader2} tone="amber" />
           <KPI label="Offline" value={stats.offlineRiders} icon={Ban} tone="zinc" />
           <KPI label="Active Orders" value={stats.activeOrders} icon={ClipboardList} />
           <KPI label="Unassigned" value={stats.unassignedOrders} icon={ShieldAlert} tone="rose" />
        </section>
      )}

      {view === "list" ? (
        <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                placeholder="Search zones by name or city..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <DataTable
            columns={["Zone Name", "City", "Status", "Riders", "Subzones", "Radius", "Orders", "Created", "Actions"]}
            rows={filtered.map(z => {
              const szCount = subzones.filter(s => s.zone_id === z.id).length;
              return [
                <button 
                  key={z.id + "n"} 
                  onClick={() => { setSelectedZoneId(z.id); setView("detail"); }}
                  className="font-bold text-primary hover:underline"
                >
                  {z.name}
                </button>,
                z.city,
                <StatusBadge key={z.id + "s"} label={z.status} />,
                "12 active", // Mock aggregation for now
                szCount,
                `${z.pickup_radius_km}km`,
                "8 active",
                format(new Date(z.created_at), "MMM d, yyyy"),
                <div key={z.id + "a"} className="flex items-center gap-1.5">
                   <ZoneStatusToggle zone={z} />
                   <button className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-primary-soft hover:text-primary">
                     <Edit2 className="h-3.5 w-3.5" />
                   </button>
                   <button onClick={() => deleteZone(z.id).then(refresh)} className="grid h-7 w-7 place-items-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100">
                     <Trash2 className="h-3.5 w-3.5" />
                   </button>
                </div>
              ];
            })}
          />
        </section>
      ) : (
        <section className="h-[600px] rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60">
           <LeafletMap 
             className="h-full w-full" 
             markers={[]} // Will add restaurant and rider markers here
           />
        </section>
      )}
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

function ZoneStatusToggle({ zone }: { zone: DeliveryZone }) {
  const active = zone.status === "ACTIVE";
  const toggle = async () => {
    const next = active ? "DISABLED" : "ACTIVE";
    if (active) {
      if (!confirm(`Disable ${zone.name}? No new orders will be assigned to this zone.`)) return;
    }
    await updateZone(zone.id, { status: next });
    toast.success(`${zone.name} is now ${next.toLowerCase()}`);
  };

  return (
    <button 
      onClick={toggle}
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition ${active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
    >
      {active ? "On" : "Off"}
    </button>
  );
}

function ZoneDetailView({ zone, subzones, onBack }: { zone: DeliveryZone; subzones: Subzone[]; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "subzones" | "riders" | "restaurants" | "orders">("overview");

  return (
    <div className="space-y-6">
       <header className="flex items-center gap-4">
         <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60 transition active:scale-95">
           <X className="h-5 w-5" />
         </button>
         <div>
           <div className="flex items-center gap-2">
             <h1 className="font-display text-2xl font-extrabold">{zone.name}</h1>
             <StatusBadge label={zone.status} />
           </div>
           <p className="text-sm text-muted-foreground">{zone.city} · {subzones.length} Subzones</p>
         </div>
       </header>

       <nav className="flex gap-1 border-b border-border/60">
         {[
           { id: "overview", label: "Overview", icon: Layers },
           { id: "subzones", label: "Subzones", icon: MapIcon },
           { id: "riders", label: "Riders", icon: Bike },
           { id: "restaurants", label: "Restaurants", icon: Store },
           { id: "orders", label: "Live Orders", icon: ClipboardList },
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setActiveTab(t.id as any)}
             className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
           >
             <t.icon className="h-4 w-4" />
             {t.label}
           </button>
         ))}
       </nav>

       <div className="grid gap-6 lg:grid-cols-3">
         <div className="lg:col-span-2 space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <section className="h-[400px] rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60">
                  <LeafletMap className="h-full w-full" />
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ConfigCard label="Pickup Radius" value={`${zone.pickup_radius_km} km`} />
                  <ConfigCard label="Max Delivery Distance" value={`${zone.max_delivery_distance_km} km`} />
                  <ConfigCard label="Max Orders per Rider" value={zone.max_orders_per_rider} />
                  <ConfigCard label="Assignment Timeout" value={`${zone.assignment_timeout_sec}s`} />
                </div>
              </div>
            )}

            {activeTab === "subzones" && (
               <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
                 <div className="mb-6 flex items-center justify-between">
                   <h3 className="font-display text-lg font-extrabold">Subzones</h3>
                   <button className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                     <Plus className="h-3.5 w-3.5" /> Add Subzone
                   </button>
                 </div>
                 <DataTable 
                   columns={["Subzone Name", "Status", "Riders", "Orders", "Actions"]}
                   rows={subzones.map(s => [
                     <span key={s.id+"n"} className="font-bold">{s.name}</span>,
                     <StatusBadge key={s.id+"s"} label={s.status} />,
                     "4 active",
                     "2 orders",
                     <div key={s.id+"a"} className="flex items-center gap-1.5">
                       <button className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-700">On</button>
                       <button className="text-muted-foreground hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                     </div>
                   ])}
                 />
               </section>
            )}
         </div>

         <aside className="space-y-6">
            <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
              <h3 className="font-display text-lg font-extrabold">Zone Activity</h3>
              <div className="mt-4 space-y-4">
                 <ActivityItem label="New rider assigned" time="2m ago" />
                 <ActivityItem label="Zone status: ACTIVE" time="1h ago" />
                 <ActivityItem label="Subzone 'Gotri' created" time="2h ago" />
              </div>
            </section>
         </aside>
       </div>
    </div>
  );
}

function ConfigCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className="font-display font-extrabold text-primary">{value}</span>
    </div>
  );
}

function ActivityItem({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{time}</span>
    </div>
  );
}
