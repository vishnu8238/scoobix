import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Search, Plus, Map as MapIcon, Edit2, Trash2, Loader2, Globe } from "lucide-react";
import { ZoneFormModal } from "@/components/ZoneFormModal";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/zones")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Zones" }] }),
  component: LogisticsZones,
});

function LogisticsZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchZones();
      setZones(data);
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
          <h1 className="font-display text-2xl font-extrabold">Zone Management</h1>
          <p className="text-muted-foreground text-sm">Define operational boundaries and service hubs.</p>
        </div>
        <button 
          onClick={() => setIsZoneModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> New Zone
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <Globe className="h-5 w-5" />
            <h3 className="font-bold">Active Zones</h3>
          </div>
          <p className="text-3xl font-display font-extrabold">{zones.filter(z => z.status === "ACTIVE").length}</p>
          <p className="text-xs text-muted-foreground">Operational service areas</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3 mb-4 text-amber-500">
            <MapIcon className="h-5 w-5" />
            <h3 className="font-bold">Total Coverage</h3>
          </div>
          <p className="text-3xl font-display font-extrabold">{zones.reduce((acc, z) => acc + (z.pickup_radius_km || 0), 0)} km</p>
          <p className="text-xs text-muted-foreground">Cumulative service radius</p>
        </div>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Filter zones..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Name", "City", "Status", "Radius", "Created", "Actions"]}
            rows={zones.filter(z => z.name.toLowerCase().includes(q.toLowerCase())).map(z => [
              <span key={z.id} className="font-bold">{z.name}</span>,
              z.city,
              <StatusBadge key={z.id} label={z.status} />,
              `${z.pickup_radius_km}km`,
              z.created_at ? format(new Date(z.created_at), "MMM d, yyyy") : "-",
              <div key={z.id} className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-muted rounded-lg"><Edit2 className="h-4 w-4" /></button>
                <button className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg"><Trash2 className="h-4 w-4" /></button>
              </div>
            ])}
          />
        )}
      </section>

      {isZoneModalOpen && (
        <ZoneFormModal 
          isOpen={isZoneModalOpen} 
          onClose={() => setIsZoneModalOpen(false)} 
          onSuccess={refresh} 
        />
      )}
    </div>
  );
}
