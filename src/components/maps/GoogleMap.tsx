import { useEffect, useRef, useState, useMemo } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  MapControl,
  ControlPosition,
  MapMouseEvent,
} from "@vis.gl/react-google-maps";
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
  riderProgress?: number;
  riderLabel?: string;
  center?: LatLng;
  zoom?: number;
  onPick?: (c: LatLng) => void;
  pickedAt?: LatLng | null;
  className?: string;
  height?: number | string;
  interactive?: boolean;
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
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {label}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

// Polyline component using Google Maps JS SDK directly
function Polyline({ points, color, dash }: { points: LatLng[]; color?: string; dash?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const poly = new google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: color || "#3B82F6",
      strokeOpacity: 0.9,
      strokeWeight: 4,
      icons: dash ? [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
        offset: "0",
        repeat: "20px"
      }] : [],
      map,
    });
    if (dash) poly.setOptions({ strokeOpacity: 0 });
    return () => poly.setMap(null);
  }, [map, points, color, dash]);
  return null;
}

// Polygon component
function Polygon({ points, color, label }: { points: LatLng[]; color?: string; label?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const poly = new google.maps.Polygon({
      paths: points,
      strokeColor: color || "#3B82F6",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color || "#3B82F6",
      fillOpacity: 0.15,
      map,
    });
    return () => poly.setMap(null);
  }, [map, points, color, label]);
  return null;
}

function GoogleMapInner({
  markers = [],
  route,
  polygons = [],
  riderProgress = 0,
  riderLabel,
  center,
  zoom = 14,
  onPick,
  pickedAt,
  className = "",
  height = 260,
  interactive = true,
}: Props) {
  const map = useMap();
  const [currentRiderPos, setCurrentRiderPos] = useState<LatLng | null>(null);

  // Sync rider position
  useEffect(() => {
    if (route) {
      setCurrentRiderPos(interpolate(route.from, route.to, riderProgress));
    }
  }, [route, riderProgress]);

  // Handle map click for picking
  const handleMapClick = (e: MapMouseEvent) => {
    if (onPick && e.detail.latLng) {
      onPick(e.detail.latLng);
    }
  };

  // Fit bounds when markers/route change
  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
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

    if (pickedAt) {
      bounds.extend(pickedAt);
      hasPoints = true;
    }

    if (hasPoints) {
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      // Only set max zoom if it's too zoomed in
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom()! > 16) map.setZoom(16);
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
        mapId="bf51a910020fa25a" // Use a generic map ID for advanced markers
      >
        {markers.map(m => (
          <CustomMarker key={m.id} kind={m.kind} label={m.label} lat={m.lat} lng={m.lng} />
        ))}

        {polygons.map(p => (
          <Polygon key={p.id} points={p.points} color={p.color} label={p.label} />
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

        {(pickedAt || (onPick && !pickedAt)) && (
          <CustomMarker 
            kind="pin" 
            pulse 
            lat={pickedAt?.lat ?? 0} 
            lng={pickedAt?.lng ?? 0} 
          />
        )}
      </Map>
    </div>
  );
}

export function GoogleMap(props: Props) {
  return (
    <GoogleMapsProvider>
      <GoogleMapInner {...props} />
    </GoogleMapsProvider>
  );
}
