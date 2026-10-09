import { useEffect, useRef, useState, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
// Vite's dependency pre-bundling breaks maplibre's relative worker URL (404 on
// maplibre-gl-worker.mjs → blank map). Bundle the worker explicitly and register it.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { MapMarker, MapPolygon, MapPolyline, Coordinate } from "@/lib/maps/contracts";
import { interpolate, LOGISTICS_DEFAULT_CENTER } from "@/lib/geo";

type Props = {
  markers?: MapMarker[];
  route?: { from: Coordinate; to: Coordinate };
  polygons?: MapPolygon[];
  polylines?: MapPolyline[];
  riderProgress?: number;
  riderLabel?: string;
  center?: Coordinate;
  zoom?: number;
  onPick?: (c: Coordinate) => void;
  pickedAt?: Coordinate | null;
  className?: string;
  height?: number | string;
  interactive?: boolean;
  onPolygonEdit?: (id: string, points: Coordinate[]) => void;
};

const ICONS: Record<string, { emoji: string; color: string }> = {
  restaurant: { emoji: "🍽", color: "#3B82F6" },
  customer: { emoji: "🏠", color: "#1e293b" },
  rider: { emoji: "🛵", color: "#3B82F6" },
  pickup: { emoji: "📦", color: "#3B82F6" },
  drop: { emoji: "🎯", color: "#1e293b" },
  pin: { emoji: "📍", color: "#3B82F6" },
};

// Open basemap style (CartoDB Voyager)
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

export function MapLibreMap({
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [currentRiderPos, setCurrentRiderPos] = useState<Coordinate | null>(null);

  const defaultCenter = useMemo(() => {
    if (center) return center;
    if (pickedAt) return pickedAt;
    if (route) return interpolate(route.from, route.to, 0.5);
    return LOGISTICS_DEFAULT_CENTER;
  }, [center, pickedAt, route]);

  useEffect(() => {
    if (route) {
      setCurrentRiderPos(interpolate(route.from, route.to, riderProgress));
    }
  }, [route, riderProgress]);

  // Init Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [defaultCenter.lng, defaultCenter.lat],
      zoom: zoom,
      interactive: interactive,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Add Polygon Edit tool if needed
      if (onPolygonEdit && interactive) {
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: {
            polygon: true,
            trash: true
          }
        });
        map.addControl(draw as any);
        drawRef.current = draw;

        map.on("draw.update" as any, (e: any) => {
          const data = draw.getAll();
          if (data.features.length > 0) {
            const feat = data.features[0];
            if (feat.geometry.type === "Polygon") {
              const coords = (feat.geometry as any).coordinates[0].map((c: any) => ({ lng: c[0], lat: c[1] }));
              onPolygonEdit("current", coords);
            }
          }
        });
      }

      // Add sources for polygons and polylines
      (map as any).addSource("scoobix-polygons", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: "scoobix-polygons-layer",
        type: "fill",
        source: "scoobix-polygons",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#3B82F6"],
          "fill-opacity": 0.15
        }
      });
      map.addLayer({
        id: "scoobix-polygons-outline",
        type: "line",
        source: "scoobix-polygons",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#3B82F6"],
          "line-width": 2
        }
      });

      map.addSource("scoobix-polylines", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: "scoobix-polylines-layer",
        type: "line",
        source: "scoobix-polylines",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#3B82F6"],
          "line-width": ["coalesce", ["get", "weight"], 4],
          "line-opacity": 0.9,
          "line-dasharray": ["case", ["get", "dash"], ["literal", [2, 2]], ["literal", [1, 0]]]
        }
      });
    });

    if (onPick && interactive) {
      map.on("click", (e) => {
        onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Create marker data set
    const activeMarkerIds = new Set<string>();
    const allMarkersToSync = [...markers];
    
    if (pickedAt) {
      allMarkersToSync.push({ id: "picked-pin", ...pickedAt, kind: "pin" });
    }
    if (currentRiderPos) {
      allMarkersToSync.push({ id: "rider-pos", ...currentRiderPos, kind: "rider", label: riderLabel });
    }

    allMarkersToSync.forEach(m => {
      const id = m.id;
      activeMarkerIds.add(id);
      
      let marker = markersRef.current.get(id);
      if (!marker) {
        const el = document.createElement("div");
        const icon = ICONS[m.kind] || ICONS.pin;
        el.className = "scoobix-maplibre-marker";
        el.innerHTML = `
          <div style="position: relative; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9999px; background: white; box-shadow: 0 6px 18px -4px rgba(0,0,0,0.25); border: 2px solid ${icon.color}; font-size: 18px; line-height: 1;">
            <span style="position: relative;">${icon.emoji}</span>
          </div>
        `;
        
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markersRef.current.set(id, marker);
      } else {
        marker.setLngLat([m.lng, m.lat]);
      }
    });

    // Cleanup old markers
    markersRef.current.forEach((marker, id) => {
      if (!activeMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Fit bounds if needed
    if (allMarkersToSync.length > 0 && map.loaded()) {
      const bounds = new maplibregl.LngLatBounds();
      allMarkersToSync.forEach(m => bounds.extend([m.lng, m.lat]));
      polygons.forEach(p => p.points.forEach(pt => bounds.extend([pt.lng, pt.lat])));
      polylines.forEach(p => p.points.forEach(pt => bounds.extend([pt.lng, pt.lat])));
      if (route) {
        bounds.extend([route.from.lng, route.from.lat]);
        bounds.extend([route.to.lng, route.to.lat]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [markers, pickedAt, currentRiderPos, polygons, polylines, route]);

  // Sync Geometry Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    const polySource = map.getSource("scoobix-polygons") as maplibregl.GeoJSONSource;
    if (polySource) {
      polySource.setData({
        type: "FeatureCollection",
        features: polygons.map(p => ({
          type: "Feature",
          properties: { color: p.color, label: p.label },
          geometry: {
            type: "Polygon",
            coordinates: [[...p.points.map(pt => [pt.lng, pt.lat]), [p.points[0].lng, p.points[0].lat]]]
          }
        })) as any
      });
    }

    const lineSource = map.getSource("scoobix-polylines") as maplibregl.GeoJSONSource;
    if (lineSource) {
      const lines = [...polylines];
      if (route) {
        lines.push({ id: "route-line", points: [route.from, route.to], dash: true });
      }
      lineSource.setData({
        type: "FeatureCollection",
        features: lines.map(l => ({
          type: "Feature",
          properties: { color: l.color, weight: l.weight, dash: l.dash },
          geometry: {
            type: "LineString",
            coordinates: l.points.map(pt => [pt.lng, pt.lat])
          }
        })) as any
      });
    }
  }, [polygons, polylines, route]);

  return (
    <div 
      className={`relative overflow-hidden rounded-3xl ring-1 ring-border/60 shadow-card ${className}`} 
      style={{ height }}
      ref={mapContainerRef}
    />
  );
}
