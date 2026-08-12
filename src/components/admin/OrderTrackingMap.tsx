import { useEffect, useRef } from "react";
import { MapPin, Truck, Store } from "lucide-react";
import { initGoogleMaps } from "@/lib/maps-service";

type OrderTrackingMapProps = {
  restaurant: any;
  customer: any;
  rider: any;
  order: any;
};

export function OrderTrackingMap({ restaurant, customer, rider, order }: OrderTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

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

      const bounds = new google.maps.LatLngBounds();

      // Restaurant Marker
      if (restaurant?.latitude && restaurant?.longitude) {
        const pos = { lat: Number(restaurant.latitude), lng: Number(restaurant.longitude) };
        new google.maps.Marker({
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
        bounds.extend(pos);
      }

      // Customer Marker
      if (order?.latitude && order?.longitude) {
        const pos = { lat: Number(order.latitude), lng: Number(order.longitude) };
        new google.maps.Marker({
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
        bounds.extend(pos);
      }

      // Rider Marker
      if (rider?.latitude && rider?.longitude) {
        const pos = { lat: Number(rider.latitude), lng: Number(rider.longitude) };
        new google.maps.Marker({
          position: pos,
          map,
          title: "Rider",
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: "#10B981",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
            scale: 7
          }
        });
        bounds.extend(pos);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }
    };

    void run();
  }, [restaurant, customer, rider, order]);

  return (
    <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden h-[400px] relative">
      <div ref={mapRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg ring-1 ring-border/40 flex items-center gap-3">
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
                <span className="text-[10px] font-bold uppercase tracking-wider">Rider</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
