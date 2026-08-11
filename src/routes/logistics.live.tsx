import { createFileRoute } from "@tanstack/react-router";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { useCallback, useEffect, useState } from "react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Bike, Store, MapPin, Truck } from "lucide-react";

export const Route = createFileRoute("/logistics/live")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Live Map" }] }),
  component: LogisticsLiveMap,
});

function LogisticsLiveMap() {
  const [riders, setRiders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  
  const version = useTableVersion(["drivers", "restaurants", "orders", "delivery_zones"]);

  const load = useCallback(async () => {
    const [d, r, o, z] = await Promise.all([
      listTable<any>("drivers", { online_status: "eq.true" }),
      listTable<any>("restaurants", { status: "eq.approved" }),
      listTable<any>("orders", { status: "neq.DELIVERED" }),
      listTable<any>("delivery_zones", { active: "eq.true" }),
    ]);
    setRiders(d);
    setRestaurants(r);
    setOrders(o);
    setZones(z);
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const markers: any[] = [
    ...riders.map(r => ({
      id: `rider-${r.id}`,
      lat: r.lat || 12.9716,
      lng: r.lng || 77.5946,
      kind: "rider",
      label: r.name
    })),
    ...restaurants.map(r => ({
      id: `rest-${r.id}`,
      lat: r.location?.lat || 12.9716,
      lng: r.location?.lng || 77.5946,
      kind: "restaurant",
      label: r.name
    }))
  ];

  return (
    <div className="h-[calc(100vh-180px)] w-full rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60 relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur-md p-4 rounded-2xl shadow-soft ring-1 ring-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Map Layers</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-[11px] font-bold">Online Riders ({riders.length})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="h-3 w-3 rounded-full bg-orange-500" />
              <span className="text-[11px] font-bold">Partners ({restaurants.length})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold">Active Orders ({orders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status)).length})</span>
            </label>
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
          <span className="text-xs font-bold">Rider GPS Live</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold">Zones Active</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold">Realtime Sync</span>
        </div>
      </div>
    </div>
  );
}
