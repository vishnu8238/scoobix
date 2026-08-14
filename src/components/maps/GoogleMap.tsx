import { useEffect, useRef, useState, useMemo } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import type { LatLng } from "@/lib/geo";
import { interpolate } from "@/lib/geo";
import { GoogleMapsProvider } from "./GoogleMapsProvider";

type MarkerKind = "restaurant" | "customer" | "rider" | "pickup" | "drop" | "pin";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  label?: string;
};

type Props = {
  markers?: MapMarker[];
  route?: { from: LatLng; to: LatLng };
  polygons?: { id: string; points: LatLng[]; color?: string; label?: string }[];
  polylines?: { id: string; points: LatLng[]; color?: string; weight?: number; dash?: boolean }[];
  riderProgress?: number;
  riderLabel?: string;
  center?: LatLng;
  zoom?: number;
  onPick?: (c: LatLng) => void;
  pickedAt?: LatLng | null;
  className?: string;
  height?: number | string;
  interactive?: boolean;
  onPolygonEdit?: (id: string, points: LatLng[]) => void;
};

const ICONS: Record<MarkerKind, { emoji: string; color: string }> = {
  restaurant: { emoji: "🍽", color: "var(--color-primary)" },
  customer: { emoji: "🏠", color: "oklch(0.3 0.02 240)" },
  rider: { emoji: "🛵", color: "var(--color-primary)" },
  pickup: { emoji: "📦", color: "var(--color-primary)" },
  drop: { emoji: "🎯", color: "oklch(0.3 0.02 240)" },
  pin: { emoji: "📍", color: "var(--color-primary)" },
};

function CustomMarker({ kind, pulse, label, lat, lng }: { kind: MarkerKind; pulse?: boolean; label?: string; lat: number; lng: number }) {
  const { emoji, color } = ICONS[kind];
  return (
    <AdvancedMarker position={{ lat, lng }} title={label}>
      <div style={{ position: "relative", display: "grid", placeItems: "center", width: "36px", height: "36px", borderRadius: "9999px", background: "white", boxShadow: "0 6px 18px -4px rgba(0,0,0,0.25)", border: `2px solid ${color}`, fontSize: "18px", lineHeight: 1 }}>
        {pulse && (
          <span style={{ position: "absolute", inset: "-10px", borderRadius: "9999px", background: color, opacity: 0.18, animation: "cravio-pulse 1.8s ease-out infinite" }} />
        )}
        <span style={{ position: "relative" }}>{emoji}</span>
        {label && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background shadow-lg transition-opacity pointer-events-none group-hover:opacity-100">
            {label}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function Polyline({ points, color, weight, dash }: { points: LatLng[]; color?: string; weight?: number; dash?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const poly = new (window as any).google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: color || "#3B82F6",
      strokeOpacity: dash ? 0 : 0.9,
      strokeWeight: weight || 4,
      icons: dash ? [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
        offset: "0",
        repeat: "20px"
      }] : [],
      map,
    });
    return () => poly.setMap(null);
  }, [map, points, color, weight, dash]);
  return null;
}

function Polygon({ id, points, color, label, editable, onEdit }: { id: string; points: LatLng[]; color?: string; label?: string; editable?: boolean; onEdit?: (id: string, points: LatLng[]) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const poly = new (window as any).google.maps.Polygon({
      paths: points,
      strokeColor: color || "#3B82F6",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color || "#3B82F6",
      fillOpacity: 0.15,
      editable: editable || false,
      map,
    });

    if (editable && onEdit) {
      const update = () => {
        const path = poly.getPath();
        const newPoints: LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const p = path.getAt(i);
          newPoints.push({ lat: p.lat(), lng: p.lng() });
        }
        onEdit(id, newPoints);
      };
      
      const listeners = [
        poly.getPath().addListener("set_at", update),
        poly.getPath().addListener("insert_at", update),
        poly.getPath().addListener("remove_at", update),
      ];
      
      return () => {
        listeners.forEach(l => (window as any).google.maps.event.removeListener(l));
        poly.setMap(null);
      };
    }

    return () => poly.setMap(null);
  }, [map, points, color, label, editable, onEdit, id]);
  return null;
}

function GoogleMapInner({
  markers = [],
  route,
  polygons = [],
  polylines = [],
  riderProgress = 0,
  riderLabel,
  center,
  zoom = 14,
  onPick,
  pickedAt,
  className = "",
  height = 260,
  interactive = true,
  onPolygonEdit,
}: Props) {
  const map = useMap();
  const [currentRiderPos, setCurrentRiderPos] = useState<LatLng | null>(null);

  useEffect(() => {
    if (route) {
      setCurrentRiderPos(interpolate(route.from, route.to, riderProgress));
    }
  }, [route, riderProgress]);

  const handleMapClick = (e: MapMouseEvent) => {
    // Manual map pinning is disabled for restaurant forms. 
    // This handler only triggers if interactive is true.
    if (interactive && onPick && e.detail.latLng) {
      onPick(e.detail.latLng);
    }
  };

  useEffect(() => {
    if (!map) return;
    const bounds = new (window as any).google.maps.LatLngBounds();
    let hasPoints = false;

    markers.forEach(m => {
      bounds.extend({ lat: m.lat, lng: m.lng });
      hasPoints = true;
    });

    if (route) {
      bounds.extend(route.from);
      bounds.extend(route.to);
      hasPoints = true;
    }

    polygons.forEach(p => {
      p.points.forEach(pt => {
        bounds.extend(pt);
        hasPoints = true;
      });
    });

    polylines.forEach(p => {
      p.points.forEach(pt => {
        bounds.extend(pt);
        hasPoints = true;
      });
    });

    if (pickedAt) {
      bounds.extend(pickedAt);
      hasPoints = true;
    }

    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      (window as any).google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom()! > 15) map.setZoom(15);
      });
    }
  }, [map, markers, route, polygons, pickedAt]);

  const defaultCenter = useMemo(() => {
    if (center) return center;
    if (pickedAt) return pickedAt;
    if (route) return interpolate(route.from, route.to, 0.5);
    return { lat: 12.9716, lng: 77.5946 };
  }, [center, pickedAt, route]);

  return (
    <div className={`relative overflow-hidden rounded-3xl ring-1 ring-border/60 shadow-card ${className}`} style={{ height }}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={zoom}
        gestureHandling={interactive ? 'auto' : 'none'}
        disableDefaultUI={!interactive}
        onClick={handleMapClick}
        mapId="DEMO_MAP_ID"
      >
        {markers.map(m => (
          <CustomMarker key={m.id} kind={m.kind} label={m.label} lat={m.lat} lng={m.lng} />
        ))}

        {polygons.map(p => (
          <Polygon 
            key={p.id} 
            id={p.id} 
            points={p.points} 
            color={p.color} 
            label={p.label} 
            editable={!!onPolygonEdit} 
            onEdit={onPolygonEdit}
          />
        ))}

        {polylines.map(p => (
          <Polyline 
            key={p.id} 
            points={p.points} 
            color={p.color} 
            weight={p.weight} 
            dash={p.dash} 
          />
        ))}

        {route && (
          <>
            <Polyline points={[route.from, route.to]} dash />
            {currentRiderPos && (
              <CustomMarker 
                kind="rider" 
                pulse 
                label={riderLabel} 
                lat={currentRiderPos.lat} 
                lng={currentRiderPos.lng} 
              />
            )}
          </>
        )}

        {pickedAt && (
          <CustomMarker 
            kind="pin" 
            pulse 
            lat={pickedAt.lat} 
            lng={pickedAt.lng} 
          />
        )}
      </Map>
    </div>
  );
}

export function GoogleMap(props: Props) {
  return (
    <GoogleMapsProvider fallback={
      <div className={`flex flex-col items-center justify-center bg-muted/20 text-muted-foreground border-2 border-dashed border-border rounded-3xl min-h-[200px] ${props.className}`} style={{ height: props.height }}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
          <MapPin className="h-6 w-6" />
        </div>
        <p className="font-display text-lg font-extrabold text-foreground">Interactive map restricted</p>
        <p className="max-w-[280px] text-xs mt-2 leading-relaxed px-4 text-center">
          Google Maps is currently unavailable. You can still define zones by searching for addresses or entering coordinates.
        </p>
        {props.onPick && (
          <div className="mt-4 grid grid-cols-2 gap-2 px-4 w-full max-w-sm">
             <input 
               type="number" step="any" placeholder="Latitude" 
               className="rounded-xl bg-background p-2 text-xs border border-border outline-none focus:ring-1 focus:ring-primary"
               onChange={(e) => {
                 const lat = parseFloat(e.target.value);
                 if (!isNaN(lat) && props.center?.lng) props.onPick({ lat, lng: props.center.lng });
               }}
             />
             <input 
               type="number" step="any" placeholder="Longitude" 
               className="rounded-xl bg-background p-2 text-xs border border-border outline-none focus:ring-1 focus:ring-primary"
               onChange={(e) => {
                 const lng = parseFloat(e.target.value);
                 if (!isNaN(lng) && props.center?.lat) props.onPick({ lat: props.center.lat, lng });
               }}
             />
          </div>
        )}
      </div>
    }>
      <GoogleMapInner {...props} />
    </GoogleMapsProvider>
  );
}
