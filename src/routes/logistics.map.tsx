import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { MapView } from "@/components/maps/MapView";
import { fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { listTable } from "@/lib/insforge-crud";
import { toast } from "sonner";
import { Bike, MapPin, Store } from "lucide-react";

export const Route = createFileRoute("/logistics/map")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Live Map" }] }),
  component: LogisticsMap,
});

function LogisticsMap() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[LOGISTICS_MAP] Loading data...");
      const [z, r] = await Promise.all([
        fetchZones().catch(err => {
          console.error("[LOGISTICS_MAP] Zones load failed:", err);
          return [] as DeliveryZone[];
        }),
        listTable<any>("drivers", { online_status: "eq.true" }).catch(err => {
          console.error("[LOGISTICS_MAP] Riders load failed:", err);
          return [];
        })
      ]);
      
      console.log(`[LOGISTICS_MAP] Loaded ${z.length} zones and ${r.length} online riders.`);
      setZones(z);
      setRiders(r);
      
      if (z.length === 0 && r.length === 0) {
        console.warn("[LOGISTICS_MAP] No data found in zones or online drivers.");
      }
    } catch (err: any) {
      console.error("[LOGISTICS_MAP] Data load failed:", err);
      toast.error(`Map data load failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="h-[calc(100vh-140px)] w-full space-y-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Logistics Map</h1>
        <p className="text-sm text-muted-foreground">Real-time visualization of fleet and zone health.</p>
      </header>

      <div className="h-full w-full rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60">
        <MapView 
          className="h-full w-full"
          polygons={zones.map(z => ({
            id: z.id,
            points: z.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
            label: z.name,
            color: "rgba(59, 130, 246, 0.2)"
          }))}
          markers={riders.map(r => ({
            id: r.id,
            lat: r.last_lat,
            lng: r.last_lng,
            label: r.name,
            kind: "rider"
          }))}
          />
      </div>
    </div>
  );
}
