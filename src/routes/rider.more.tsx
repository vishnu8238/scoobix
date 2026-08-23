import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { PageHeader } from "@/components/cravio/PageHeader";
import { MapView } from "@/components/maps/MapView";
import type { MapMarker } from "@/lib/maps/contracts";
import { useDriver } from "@/lib/driver-store";
import { useMemo, useState, useEffect } from "react";
import { fetchZones, DeliveryZone } from "@/lib/zones-api";
import { MapPin, Target, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/more")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Bazaar & Zones" }] }),
  component: () => (
    <RoleGuard allow="rider">
      <RiderWorkArea />
    </RoleGuard>
  ),
});

function RiderWorkArea() {
  const { driver, driverId } = useDriver();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchZones().then(data => {
      setZones(data);
      setLoading(false);
    });
  }, []);

  const refreshLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location updated");
      },
      () => toast.error("Could not determine location")
    );
  };

  useEffect(() => {
    refreshLocation();
  }, []);

  const activeZone = useMemo(() => {
    if (!driver?.id) return null;
    // In a real app, this would be driver.zone_id. For Part 1, we show the first active zone or Vadodara fallback.
    return zones.find(z => z.status === "ACTIVE") || null;
  }, [zones, driver]);

  const mapMarkers = useMemo((): MapMarker[] => {
    const ms: MapMarker[] = [];
    if (location) {
      ms.push({ id: "me", lat: location.lat, lng: location.lng, kind: "rider", label: "You" });
    }
    if (activeZone?.center_lat && activeZone?.center_lng) {
      ms.push({ id: "zone-center", lat: activeZone.center_lat, lng: activeZone.center_lng, kind: "pin", label: activeZone.name });
    }
    return ms;
  }, [location, activeZone]);

  const polygons = useMemo(() => {
    if (!activeZone?.boundary) return [];
    // Convert boundary to points array if it's geojson
    const points = activeZone.boundary.coordinates?.[0]?.map((c: number[]) => ({ lat: c[1], lng: c[0] })) || [];
    return [{ id: activeZone.id, points, color: "#3B82F6", label: activeZone.name }];
  }, [activeZone]);

  return (
    <div className="w-full pb-8 px-4 pt-7">
      <PageHeader title="Work Area" subtitle="Your assigned zone & boundaries" />

      <div className="mt-6 space-y-6">
        <section className="relative">
          <MapView 
            height={360}
            markers={mapMarkers}
            polygons={polygons}
            center={location || (activeZone?.center_lat && activeZone?.center_lng ? { lat: activeZone.center_lat, lng: activeZone.center_lng } : undefined)}
            zoom={13}
          />
          
          <button 
            onClick={refreshLocation}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-pop ring-1 ring-border/60 text-primary transition active:scale-90"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3">
             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Target className="h-6 w-6" />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assigned Zone</p>
                <h3 className="font-display text-lg font-extrabold tracking-tight">
                  {activeZone?.name || "No zone assigned"}
                </h3>
             </div>
          </div>
          
          <div className="mt-6 space-y-4">
             <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="font-bold text-emerald-500">Authorized to work</span>
             </div>
             <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Radius</span>
                <span className="font-bold">{activeZone?.pickup_radius_km || 5} km from center</span>
             </div>
             <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Demand Level</span>
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <Zap className="h-3 w-3 fill-amber-600" />
                  High Demand
                </span>
             </div>
          </div>
        </section>

        <div className="rounded-3xl bg-primary/5 p-5 ring-1 ring-primary/10">
           <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Location Awareness</p>
           <p className="text-xs leading-relaxed text-muted-foreground">
             Your location is being shared with logistics to ensure optimal order assignments. 
             If you leave the zone, you may stop receiving requests.
           </p>
        </div>
      </div>
    </div>
  );
}
