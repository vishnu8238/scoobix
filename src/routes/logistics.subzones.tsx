import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { fetchSubzones, type Subzone, fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Plus, Edit2, Trash2, Search, Map as MapIcon } from "lucide-react";
import { SubzoneFormModal } from "@/components/ZoneFormModal";
import { GoogleMap } from "@/components/maps/GoogleMap";

export const Route = createFileRoute("/logistics/subzones")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Subzones" }] }),
  component: LogisticsSubzones,
});

function LogisticsSubzones() {
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sz, z] = await Promise.all([fetchSubzones(), fetchZones()]);
      setSubzones(sz);
      setZones(z);
    } catch {
      toast.error("Failed to load subzones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Delivery Subzones</h1>
          <p className="text-muted-foreground text-sm">Manage localized delivery sub-neighborhoods and zones.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Add Subzone
        </button>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)} 
                  placeholder="Search subzones..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <DataTable
              columns={["Subzone", "Parent Zone", "Status", "Actions"]}
              rows={subzones.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).map(s => {
                const parent = zones.find(z => z.id === s.zone_id);
                return [
                  <span key={s.id} className="font-bold">{s.name}</span>,
                  <span key={s.id + "z"} className="text-muted-foreground font-medium">{parent?.name || "Unknown"}</span>,
                  <StatusBadge key={s.id + "s"} label={s.status} />,
                  <div key={s.id + "a"} className="flex gap-2">
                    <button className="p-1.5 hover:bg-muted rounded-lg"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ];
              })}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 h-[500px] overflow-hidden">
            <h3 className="font-display text-lg font-extrabold mb-4 flex items-center gap-2">
              <MapIcon className="h-5 w-5" /> Local Map
            </h3>
            <div className="h-full w-full rounded-2xl overflow-hidden bg-muted">
               <GoogleMap 
                 className="h-full w-full"
                 polygons={subzones.map(s => ({
                   id: s.id,
                   points: s.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
                   label: s.name,
                   color: "rgba(0,0,0,0.2)"
                 }))}
               />
            </div>
          </div>
        </aside>
      </section>

      <SubzoneFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={refresh}
        zones={zones}
      />
    </div>
  );
}
