import { createFileRoute } from "@tanstack/react-router";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { useCallback, useEffect, useState, useMemo } from "react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Bike, Store, MapPin, Truck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/logistics/live")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Live Map" }] }),
  component: LogisticsLiveMap,
});

function LogisticsLiveMap() {
  const [riders, setRiders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const version = useTableVersion(["drivers", "restaurants", "orders", "delivery_zones"]);

  const load = useCallback(async () => {
    try {
      const [d, r, o] = await Promise.all([
        listTable<any>("drivers", { online_status: "eq.true" }),
        listTable<any>("restaurants", { status: "eq.approved" }),
        listTable<any>("orders", { status: "neq.DELIVERED" }),
      ]);
      setRiders(d);
      setRestaurants(r);
      setOrders(o);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const markers = useMemo(() => [
    ...riders.map(r => ({
      id: `rider-${r.id}`,
      lat: r.current_lat || 12.9716,
      lng: r.current_lng || 77.5946,
      kind: "rider" as const,
      label: r.name || "Rider"
    })),
    ...restaurants.map(r => ({
      id: `rest-${r.id}`,
      lat: r.location?.lat || 12.9716,
      lng: r.location?.lng || 77.5946,
      kind: "restaurant" as const,
      label: r.name || "Restaurant"
    }))
  ], [riders, restaurants]);

  if (loading && !riders.length && !restaurants.length) {
    return (
      <div className="h-[calc(100vh-180px)] w-full rounded-3xl bg-card flex items-center justify-center ring-1 ring-border/60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] w-full rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60 relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur-md p-4 rounded-2xl shadow-soft ring-1 ring-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Map Layers</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-[11px] font-bold">Online Riders ({riders.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-500" />
              <span className="text-[11px] font-bold">Partners ({restaurants.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold">Active Orders ({orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status)).length})</span>
            </div>
          </div>
        </div>
      </div>
      
      <GoogleMap 
        center={{ lat: 12.9716, lng: 77.5946 }}
        zoom={13}
        markers={markers}
        interactive={true}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md px-6 py-3 rounded-full shadow-glow ring-1 ring-border/60 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-widest">GPS Live</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold uppercase tracking-widest">Zone Hubs</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-widest">Realtime</span>
        </div>
      </div>
    </div>
  );
}
