import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { listTable } from "@/lib/insforge-crud";
import { LiveTrackingViewProps } from "@/lib/maps/contracts";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

export function MapLibreOrderTracking({ restaurant, customer, rider, order, showAllRiders = false, className }: LiveTrackingViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [77.5946, 12.9716],
      zoom: 13,
      interactive: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      updateEntities();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const updateEntities = async () => {
    const map = mapRef.current;
    if (!map) return;

    const entities: any[] = [];
    const bounds = new maplibregl.LngLatBounds();

    if (restaurant?.latitude && restaurant?.longitude) {
      const pos = { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude), id: "restaurant", kind: "restaurant" };
      entities.push(pos);
      bounds.extend([pos.lng, pos.lat]);
    }

    if (order?.latitude && order?.longitude) {
      const pos = { lat: Number(order.latitude), lng: Number(order.longitude), id: "customer", kind: "customer" };
      entities.push(pos);
      bounds.extend([pos.lng, pos.lat]);
    }

    if (rider?.latitude && rider?.longitude) {
      const pos = { lat: Number(rider.latitude), lng: Number(rider.longitude), id: "rider", kind: "rider" };
      entities.push(pos);
      bounds.extend([pos.lng, pos.lat]);
    }

    if (showAllRiders) {
      setLoadingDrivers(true);
      try {
        const params: any = { online_status: "eq.true", limit: 50 };
        if (order?.zone_id) params.zone_id = `eq.${order.zone_id}`;
        const drivers = await listTable("drivers", params);
        
        drivers.forEach((driver: any) => {
          if (driver.latitude && driver.longitude && driver.id !== rider?.id) {
            const pos = { lat: Number(driver.latitude), lng: Number(driver.longitude), id: `driver-${driver.id}`, kind: "nearby" };
            entities.push(pos);
            bounds.extend([pos.lng, pos.lat]);
          }
        });
      } catch (e) {
        console.error("Failed to load nearby drivers", e);
      } finally {
        setLoadingDrivers(false);
      }
    }

    // Sync markers
    const activeIds = new Set<string>();
    entities.forEach(e => {
      activeIds.add(e.id);
      let marker = markersRef.current.get(e.id);
      if (!marker) {
        const el = document.createElement("div");
        const color = e.kind === "restaurant" ? "#3B82F6" : e.kind === "customer" ? "#EF4444" : e.kind === "rider" ? "#10B981" : "#94a3b8";
        el.innerHTML = `<div style="width:12px; height:12px; background:${color}; border:2px solid white; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`;
        marker = new maplibregl.Marker({ element: el }).setLngLat([e.lng, e.lat]).addTo(map);
        markersRef.current.set(e.id, marker);
      } else {
        marker.setLngLat([e.lng, e.lat]);
      }
    });

    markersRef.current.forEach((m, id) => {
      if (!activeIds.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80 });
    }
  };

  useEffect(() => {
    if (mapRef.current?.loaded()) {
      updateEntities();
    }
  }, [restaurant, customer, rider, order, showAllRiders]);

  return (
    <div className={`rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden h-[450px] relative ${className || ""}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg ring-1 ring-border/40 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Restaurant</span>
          </div>
          <div className="h-3 w-px bg-border/60" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Customer</span>
          </div>
          {rider && (
            <>
              <div className="h-3 w-px bg-border/60" />
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Assigned Rider</span>
              </div>
            </>
          )}
        </div>
      </div>

      {loadingDrivers && (
        <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg ring-1 ring-border/40 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[9px] font-black uppercase tracking-widest">Updating Drivers...</span>
        </div>
      )}
    </div>
  );
}
