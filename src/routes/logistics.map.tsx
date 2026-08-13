import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GoogleMap } from "@/components/maps/GoogleMap";
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
      const [z, r] = await Promise.all([
        fetchZones(),
        listTable<any>("drivers", { online_status: "eq.true" })
      ]);
      setZones(z);
      setRiders(r);
    } catch {
      toast.error("Failed to load map data");
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
        <GoogleMap 
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
