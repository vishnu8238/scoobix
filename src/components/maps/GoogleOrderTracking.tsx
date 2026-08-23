/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { initGoogleMaps } from "@/lib/maps-service";
import { listTable } from "@/lib/insforge-crud";
import { LiveTrackingViewProps } from "@/lib/maps/contracts";

export function GoogleOrderTracking({ restaurant, customer, rider, order, showAllRiders = false, className }: LiveTrackingViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const run = async () => {
      const google = await initGoogleMaps();
      const map = new google.maps.Map(mapRef.current!, {
        zoom: 13,
        center: { lat: 12.9716, lng: 77.5946 }, // Fallback to Bangalore
        styles: [
          {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }]
          },
          {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#193341" }]
          },
          {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{ "color": "#2c3e50" }]
          }
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });

      googleMapRef.current = map;
      updateMarkers(google, map);
    };

    void run();
  }, [restaurant, customer, rider, order]);

  useEffect(() => {
    if (showAllRiders && googleMapRef.current) {
      void loadAndShowAllDrivers();
    }
  }, [showAllRiders, order?.zone_id]);

  const loadAndShowAllDrivers = async () => {
    if (!googleMapRef.current) return;
    setLoadingDrivers(true);
    try {
      const google = await initGoogleMaps();
      const params: any = { online_status: "eq.true", limit: 50 };
      if (order?.zone_id) params.zone_id = `eq.${order.zone_id}`;
      
      const drivers = await listTable("drivers", params);
      
      drivers.forEach((driver: any) => {
        if (driver.latitude && driver.longitude && driver.id !== rider?.id) {
          const marker = new google.maps.Marker({
            position: { lat: Number(driver.latitude), lng: Number(driver.longitude) },
            map: googleMapRef.current,
            title: `Driver: ${String(driver.id).slice(0, 8)}`,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              fillColor: "#94a3b8",
              fillOpacity: 0.6,
              strokeColor: "#FFFFFF",
              strokeWeight: 1,
              scale: 5
            }
          });
          markersRef.current.push(marker);
        }
      });
    } catch (error) {
      console.error("Failed to load nearby drivers for map", error);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const updateMarkers = (google: any, map: any) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    if (restaurant?.latitude && restaurant?.longitude) {
      const pos = { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: "Restaurant",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#3B82F6",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
          scale: 8
        }
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }

    if (order?.latitude && order?.longitude) {
      const pos = { lat: Number(order.latitude), lng: Number(order.longitude) };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: "Customer",
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: "#EF4444",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
          scale: 6
        }
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }

    if (rider?.latitude && rider?.longitude) {
      const pos = { lat: Number(rider.latitude), lng: Number(rider.longitude) };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: "Assigned Rider",
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: "#10B981",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
          scale: 7
        }
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  };

  return (
    <div className={`rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden h-[450px] relative ${className || ""}`}>
      <div ref={mapRef} className="w-full h-full" />
      
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
          {showAllRiders && (
            <>
              <div className="h-3 w-px bg-border/60" />
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Nearby Drivers</span>
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