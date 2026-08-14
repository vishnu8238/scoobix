import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Search, Plus, Map as MapIcon, RotateCcw, List, ListFilter, LayoutGrid, Layers, ChevronRight, X } from "lucide-react";
import { fetchZones, type DeliveryZone, type Subzone, fetchSubzones } from "@/lib/zones-api";
import { ZoneFormModal } from "@/components/ZoneFormModal";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { ZoneDirectoryItem } from "./ZoneDirectoryItem";
import { cn } from "@/lib/format";
import type { LatLng } from "@/lib/geo";

export function ZoneManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [isListHidden, setIsListHidden] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | undefined>(undefined);
  const [mapCenter, setMapCenter] = useState<LatLng | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number>(12);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[ZONE_MANAGER] Refreshing data...");
      const [z, sz] = await Promise.all([
        fetchZones().catch(err => {
          console.error("[ZONE_MANAGER] Zones failed:", err);
          throw err;
        }), 
        fetchSubzones().catch(err => {
          console.error("[ZONE_MANAGER] Subzones failed:", err);
          return [];
        })
      ]);
      setZones(z);
      setSubzones(sz);
      console.log(`[ZONE_MANAGER] Loaded ${z.length} zones, ${sz.length} subzones`);
    } catch (err: any) {
      console.error("[ZONE_MANAGER] Refresh failed:", err);
      toast.error(`Failed to load zones: ${err.message || "Check permissions"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredZones = useMemo(() => {
    return zones.filter(z => 
      z.name.toLowerCase().includes(q.toLowerCase()) || 
      z.city.toLowerCase().includes(q.toLowerCase())
    );
  }, [zones, q]);

  const handleViewZone = (zone: DeliveryZone) => {
    const coords = zone.boundary?.coordinates?.[0];
    if (coords && coords.length > 0) {
      // Use the first point as center or calculate centroid (simple average for now)
      const lats = coords.map((c: any) => c[1]);
      const lngs = coords.map((c: any) => c[0]);
      const center = {
        lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
        lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length
      };
      setMapCenter(center);
      setMapZoom(14);
      setSelectedZone(zone);
    }
  };

  const handleEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setIsModalOpen(true);
  };

  const mapPolygons = useMemo(() => {
    return zones.map(z => ({
      id: z.id,
      points: z.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
      label: z.name,
      color: selectedZone?.id === z.id ? "var(--color-primary)" : "rgba(16, 185, 129, 0.6)" // Emerald-like for inactive
    }));
  }, [zones, selectedZone]);

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Map Header Overlay */}
      <div className="absolute left-6 right-6 top-6 z-10 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white/90 p-2 pr-4 shadow-xl backdrop-blur-md ring-1 ring-black/5 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-glow">
            <MapIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-sm font-extrabold text-foreground">Zones</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {zones.length}
              </span>
            </div>
            <p className="text-[10px] font-medium text-muted-foreground">Interactive map & boundary manager</p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md ring-1 ring-black/5 dark:bg-zinc-900/90">
             <ListFilter className="h-4 w-4 text-muted-foreground" />
             <select className="bg-transparent text-sm font-bold outline-none">
               <option>All Cities</option>
               {Array.from(new Set(zones.map(z => z.city))).map(city => (
                 <option key={city}>{city}</option>
               ))}
             </select>
          </div>

          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-md ring-1 ring-black/5 dark:bg-zinc-900/90">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search zones..."
              className="w-full bg-transparent text-sm font-medium outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsListHidden(!isListHidden)}
            className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-xs font-bold shadow-lg backdrop-blur-md ring-1 ring-black/5 transition hover:bg-muted active:scale-95 dark:bg-zinc-900/90"
          >
            {isListHidden ? <LayoutGrid className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {isListHidden ? "Show List" : "Hide List"}
          </button>
          
          <button 
            onClick={refresh}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 shadow-lg backdrop-blur-md ring-1 ring-black/5 transition hover:bg-muted active:rotate-180 dark:bg-zinc-900/90"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button 
            onClick={() => { setEditingZone(undefined); setIsModalOpen(true); }}
            className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-emerald-800 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="relative flex-1">
        <GoogleMap 
          className="h-full w-full"
          center={mapCenter}
          zoom={mapZoom}
          polygons={mapPolygons}
        />

        {/* Floating Sidebar */}
        <aside className={cn(
          "absolute right-6 top-24 bottom-6 z-10 w-80 overflow-hidden rounded-3xl bg-white/95 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 transition-all duration-500 ease-in-out dark:bg-zinc-900/95 flex flex-col",
          isListHidden ? "translate-x-[calc(100%+40px)] opacity-0" : "translate-x-0 opacity-100"
        )}>
          <header className="flex items-center justify-between border-b border-border/40 p-5 bg-muted/20">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-extrabold">Zones Directory</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {filteredZones.length}
              </span>
            </div>
            <button onClick={() => setIsListHidden(true)} className="p-1 hover:bg-muted rounded-lg transition">
              <X className="h-4 w-4" />
            </button>
          </header>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {filteredZones.map(zone => (
              <ZoneDirectoryItem 
                key={zone.id}
                zone={zone}
                pointsCount={zone.boundary?.coordinates?.[0]?.length || 0}
                onView={handleViewZone}
                onEdit={handleEditZone}
              />
            ))}
            {filteredZones.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Search className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-xs font-bold">No zones found</p>
              </div>
            )}
          </div>
        </aside>

        {/* Map Bottom Stats Overlay */}
        <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 overflow-hidden rounded-2xl bg-white/90 p-1.5 shadow-lg backdrop-blur-md ring-1 ring-black/5 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Map Active
          </div>
          <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground border-l border-border/40">
            {Array.from(new Set(zones.map(z => z.city))).length} Cities
          </div>
          <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground border-l border-border/40">
            {zones.length} Zones
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ZoneFormModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={refresh}
          initialData={editingZone}
        />
      )}
    </div>
  );
}
