import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Map as MapIcon, Layers, Users, Store, Bike, ClipboardList, Ban, Check, Edit2, Trash2, X, Loader2, Database, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { updateZone, deleteZone, getZoneStats, type DeliveryZone, type Subzone } from "@/lib/zones-api";
import { getZonesWithSubzones, seedVadodaraStructure } from "@/lib/zones.functions";
import { useTableVersion } from "@/lib/realtime-hooks";
import { format } from "date-fns";
import { ZoneFormModal, SubzoneFormModal } from "@/components/ZoneFormModal";

export const Route = createFileRoute("/logistics/live")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Zones & Delivery Management" }] }),
  component: LogisticsLive,
});

function LogisticsLive() {
  const [view, setView] = useState<"list" | "map">("list");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState("");
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isSubzoneModalOpen, setIsSubzoneModalOpen] = useState(false);
  
  const version = useTableVersion(["delivery_zones", "delivery_subzones", "drivers", "orders"]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, st] = await Promise.all([
        getZonesWithSubzones(),
        getZoneStats()
      ]);
      setZones(data?.zones || []);
      setSubzones(data?.subzones || []);
      setStats(st);
    } catch (err) {
      toast.error("Failed to load zones data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh, version]);

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
            rows={zones.filter(z => z.name.toLowerCase().includes(q.toLowerCase())).map(z => [
              <span key={z.id} className="font-bold text-primary">{z.name}</span>,
              z.city,
              <StatusBadge key={z.id + "s"} label={z.status} />,
              "12 active",
              subzones.filter(s => s.zone_id === z.id).length,
              `${z.pickup_radius_km}km`,
              "8 active",
              format(new Date(z.created_at), "MMM d, yyyy"),
              <div key={z.id + "a"} className="flex items-center gap-1.5">
                 <button className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-primary-soft hover:text-primary">
                   <Edit2 className="h-3.5 w-3.5" />
                 </button>
              </div>
            ])}
          />
        </section>
      ) : (
        <section className="h-[600px] rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60">
           <GoogleMap 
             className="h-full w-full" 
             polygons={zones.map(z => ({
               id: z.id,
               points: z.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
               label: z.name,
               color: z.status === "ACTIVE" ? "var(--color-primary)" : "#ef4444"
             }))}
             markers={[]} 
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
