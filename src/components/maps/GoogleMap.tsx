import { useEffect, useRef, useState, useMemo } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import type { LatLng } from "@/lib/geo";
import { interpolate, LOGISTICS_DEFAULT_CENTER } from "@/lib/geo";
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
  const polyRef = useRef<any>(null);
  const editingRef = useRef(false);
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // Create the polygon exactly once per map/id. Editing never recreates it.
  useEffect(() => {
    if (!map) return;
    const initial = pointsRef.current;
    if (!initial.length) return;

    const poly = new (window as any).google.maps.Polygon({
      paths: initial,
      strokeColor: color || "#3B82F6",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color || "#3B82F6",
      fillOpacity: 0.15,
      editable: editable || false,
      draggable: false,
      map,
    });
    polyRef.current = poly;

    const listeners: any[] = [];
    if (editable) {
      const update = () => {
        const path = poly.getPath();
        const newPoints: LatLng[] = [];
        for (let i = 0; i < path.getLength(); i++) {
          const p = path.getAt(i);
          newPoints.push({ lat: p.lat(), lng: p.lng() });
        }
        editingRef.current = true;
        onEditRef.current?.(id, newPoints);
      };
      const path = poly.getPath();
      listeners.push(
        path.addListener("set_at", update),
        path.addListener("insert_at", update),
        path.addListener("remove_at", update),
      );
    }

    return () => {
      listeners.forEach(l => (window as any).google.maps.event.removeListener(l));
      poly.setMap(null);
      polyRef.current = null;
    };
  }, [map, id, editable]);

  // Sync external point changes without remounting; skip echoes of our own edits.
  useEffect(() => {
    const poly = polyRef.current;
    if (!poly) return;
    if (editingRef.current) {
      editingRef.current = false;
      return;
    }
    if (!points.length) return;
    poly.setPaths(points);
  }, [points]);

  useEffect(() => {
    polyRef.current?.setOptions({ strokeColor: color || "#3B82F6", fillColor: color || "#3B82F6" });
  }, [color]);

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

  // When polygons are editable, auto-fit runs only once (initial polygon load/completion),
  // never on vertex drag / insert / remove.
  const isEditing = !!onPolygonEdit;
  const didFitRef = useRef(false);

  // Manual centering should skip auto-fit if center prop is provided explicitly
  useEffect(() => {
    if (center) {
      didFitRef.current = true;
    }
  }, [center]);

  useEffect(() => {
    if (!map) return;
    if (isEditing && didFitRef.current) return;
    
    // Explicitly check for boundary editing state: skip fitBounds if user is actively interacting
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

    if (polylines) {
      polylines.forEach(p => {
        p.points.forEach(pt => {
          bounds.extend(pt);
          hasPoints = true;
        });
      });
    }

    if (pickedAt) {
      bounds.extend(pickedAt);
      hasPoints = true;
    }

    if (hasPoints) {
      didFitRef.current = true;
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      (window as any).google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom()! > 15) map.setZoom(15);
      });
    }
  }, [map, markers, route, polygons, pickedAt, isEditing, polylines]);

  const defaultCenter = useMemo(() => {
    if (center) return center;
    if (pickedAt) return pickedAt;
    if (route) return interpolate(route.from, route.to, 0.5);
    
    // Check if we are in a Logistics or Admin context by URL
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/logistics") || path.startsWith("/admin")) {
        return LOGISTICS_DEFAULT_CENTER;
      }
    }
    
    return { lat: 12.9716, lng: 77.5946 }; // Legacy Bengaluru fallback
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
      <div className={`flex flex-col items-center justify-center bg-muted/20 text-muted-foreground border-2 border-dashed border-border rounded-3xl min-h-[140px] p-4 ${props.className}`} style={{ height: props.height }}>
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        <p className="font-display text-sm font-extrabold text-foreground">Interactive map restricted</p>
        <p className="max-w-[280px] text-[10px] mt-1 leading-relaxed text-center opacity-70">
          Google Maps is currently unavailable. Please use the manual boundary editor below to define your zone coordinates.
        </p>
      </div>
    }>
      <GoogleMapInner {...props} />
    </GoogleMapsProvider>
  );
}
