import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { fetchSubzones, type Subzone, fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Plus, Edit2, Trash2, Loader2, Map as MapIcon, Layers } from "lucide-react";
import { SubzoneFormModal } from "@/components/ZoneFormModal";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/subzones")({
  component: LogisticsSubzones,
});

function LogisticsSubzones() {
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const zoneName = (id: string) => zones.find(z => z.id === id)?.name || "Unknown Zone";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Subzone Management</h1>
          <p className="text-muted-foreground text-sm">Fine-grained delivery sector optimization.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Add Subzone
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-extrabold">{subzones.length}</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Subzones</p>
          </div>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <MapIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-extrabold">{new Set(subzones.map(s => s.zone_id)).size}</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Zones Covered</p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Subzone", "Parent Zone", "Status", "Actions"]}
            rows={subzones.map(s => [
              <span key={s.id} className="font-bold">{s.name}</span>,
              <span key={s.id} className="text-sm font-medium text-muted-foreground">{zoneName(s.zone_id)}</span>,
              <StatusBadge key={s.id} label={s.status} />,
              <div key={s.id} className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-muted rounded-lg transition"><Edit2 className="h-4 w-4" /></button>
                <button className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition"><Trash2 className="h-4 w-4" /></button>
              </div>
            ])}
          />
        )}
      </section>

      {isModalOpen && (
        <SubzoneFormModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={refresh}
          zones={zones}
        />
      )}
    </div>
  );
}
