import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Search, Plus, Map as MapIcon, Edit2, Trash2, Loader2, Database } from "lucide-react";
import { fetchZones, type DeliveryZone, type Subzone, fetchSubzones } from "@/lib/zones-api";
import { format } from "date-fns";
import { ZoneFormModal, SubzoneFormModal } from "@/components/ZoneFormModal";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { deleteZone } from "@/lib/zones-api";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/zones")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Zones" }] }),
  component: LogisticsZones,
});

function LogisticsZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [z, sz] = await Promise.all([fetchZones(), fetchSubzones()]);
      setZones(z);
      setSubzones(sz);
    } catch {
      toast.error("Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Delivery Zones</h1>
          <p className="text-muted-foreground text-sm">Manage city-wide delivery boundaries and logistics.</p>
        </div>
        <button 
          onClick={() => setIsZoneModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Create Zone
        </button>
      </header>

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
          columns={["Name", "City", "Status", "Radius", "Subzones", "Created", "Actions"]}
          rows={zones.filter(z => z.name.toLowerCase().includes(q.toLowerCase())).map(z => [
            <span key={z.id} className="font-bold text-primary">{z.name}</span>,
            z.city,
            <StatusBadge key={z.id + "-status"} label={z.status} />,
            `${z.pickup_radius_km}km`,
            subzones.filter(s => s.zone_id === z.id).length,
            z.created_at ? format(new Date(z.created_at), "MMM d, yyyy") : "-",
            <div key={z.id + "-actions"} className="flex items-center gap-2">
              <button className="p-1.5 hover:bg-muted rounded-lg"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => deleteZone(z.id).then(refresh)} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg"><Trash2 className="h-4 w-4" /></button>
            </div>
          ])}
        />
      </section>

      <ZoneFormModal 
        isOpen={isZoneModalOpen} 
        onClose={() => setIsZoneModalOpen(false)} 
        onSuccess={refresh} 
      />
    </div>
  );
}
