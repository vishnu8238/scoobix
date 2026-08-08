import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { interpolate } from "@/lib/geo";

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
  /** Draws a dashed route line + animates a rider marker along it. */
  route?: { from: LatLng; to: LatLng };
  /** Polygons for zone/subzone boundaries */
  polygons?: { id: string; points: LatLng[]; color?: string; label?: string }[];
  /** 0..1 along `route`. Smoothly animates when changed. */
  riderProgress?: number;
  riderLabel?: string;
  center?: LatLng;
  zoom?: number;
  /** Click-to-pick a pin. Returns the coordinates of the click. */
  onPick?: (c: LatLng) => void;
  /** Initial pin position for the picker. */
  pickedAt?: LatLng | null;
  className?: string;
  height?: number | string;
  /** Disable scroll/zoom/drag for tiny preview cards. */
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

/** Single cached module load — every effect reuses the same promise. */
let leafletPromise: Promise<any> | undefined;
function loadLeaflet() {
  if (!leafletPromise) leafletPromise = import("leaflet").then((m) => m.default);
  return leafletPromise;
}

function buildDivIcon(L: any, kind: MarkerKind, pulse = false) {
  const { emoji, color } = ICONS[kind];
  const ring = pulse
    ? `<span style="position:absolute;inset:-10px;border-radius:9999px;background:${color};opacity:0.18;animation:cravio-pulse 1.8s ease-out infinite;"></span>`
    : "";
  return L.divIcon({
    className: "cravio-map-marker",
    html: `<div style="position:relative;display:grid;place-items:center;width:36px;height:36px;border-radius:9999px;background:white;box-shadow:0 6px 18px -4px rgba(0,0,0,0.25);border:2px solid ${color};font-size:18px;line-height:1;">${ring}<span style="position:relative;">${emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function LeafletMap({
  markers = [],
  route,
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
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const pickMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const currentProgressRef = useRef<number>(riderProgress);
  const [ready, setReady] = useState(false);

  // Init map once
  useEffect(() => {
    if (typeof window === "undefined" || !elRef.current) return;
    let disposed = false;
    let map: any;
    (async () => {
      const L = await loadLeaflet();
      if (disposed || !elRef.current) return;
      const c = center ?? (route ? interpolate(route.from, route.to, 0.5) : { lat: 12.9716, lng: 77.5946 });
      map = L.map(elRef.current, {
        center: [c.lat, c.lng],
        zoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        keyboard: interactive,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      polygonLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (map) map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      riderMarkerRef.current = null;
      pickMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync static markers + route
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = await loadLeaflet();
      const map = mapRef.current;
      const layer = markerLayerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();

      markers.forEach((m) => {
        const mk = L.marker([m.lat, m.lng], { icon: buildDivIcon(L, m.kind) });
        if (m.label) mk.bindTooltip(m.label, { direction: "top", offset: [0, -16], className: "cravio-map-tip" });
        mk.addTo(layer);
      });

      // route line
      if (routeLineRef.current) { map.removeLayer(routeLineRef.current); routeLineRef.current = null; }
      if (route) {
        routeLineRef.current = L.polyline(
          [[route.from.lat, route.from.lng], [route.to.lat, route.to.lng]],
          { color: "var(--color-primary)" as any, weight: 4, opacity: 0.9, dashArray: "8 8", lineCap: "round" },
        ).addTo(map);
      }

      // fit bounds to combined points
      const pts = [
        ...markers.map((m) => [m.lat, m.lng] as [number, number]),
        ...(route ? [[route.from.lat, route.from.lng], [route.to.lat, route.to.lng]] as [number, number][] : []),
      ];
      if (pts.length >= 2) {
        map.fitBounds(pts as any, { padding: [40, 40], maxZoom: 15, animate: true });
      } else if (pts.length === 1) {
        map.setView(pts[0] as any, zoom, { animate: true });
      }
    })();
  }, [markers, route, ready, zoom]);

  // Rider marker animation along the route
  useEffect(() => {
    if (!ready || !route) return;
    (async () => {
      const L = await loadLeaflet();
      const map = mapRef.current;
      if (!map) return;
      if (!riderMarkerRef.current) {
        const start = interpolate(route.from, route.to, currentProgressRef.current);
        riderMarkerRef.current = L.marker([start.lat, start.lng], {
          icon: buildDivIcon(L, "rider", true),
          zIndexOffset: 1000,
        }).addTo(map);
        if (riderLabel) riderMarkerRef.current.bindTooltip(riderLabel, { direction: "top", offset: [0, -16], className: "cravio-map-tip" });
      }

      const from = currentProgressRef.current;
      const target = Math.max(0, Math.min(1, riderProgress));
      const startTs = performance.now();
      const dur = 1400;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / dur);
        const p = from + (target - from) * t;
        currentProgressRef.current = p;
        const pt = interpolate(route.from, route.to, p);
        riderMarkerRef.current?.setLatLng([pt.lat, pt.lng]);
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    })();
  }, [riderProgress, route, ready, riderLabel]);

  // Click-to-pick
  useEffect(() => {
    if (!ready || !onPick) return;
    const map = mapRef.current;
    if (!map) return;
    const handler = async (e: any) => {
      const L = await loadLeaflet();
      const { lat, lng } = e.latlng;
      if (!pickMarkerRef.current) {
        pickMarkerRef.current = L.marker([lat, lng], { icon: buildDivIcon(L, "pin", true), draggable: true }).addTo(map);
        pickMarkerRef.current.on("dragend", (ev: any) => {
          const c = ev.target.getLatLng();
          onPick({ lat: c.lat, lng: c.lng });
        });
      } else {
        pickMarkerRef.current.setLatLng([lat, lng]);
      }
      onPick({ lat, lng });
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [ready, onPick]);

  // Sync external pickedAt
  useEffect(() => {
    if (!ready || !pickedAt) return;
    (async () => {
      const L = await loadLeaflet();
      const map = mapRef.current;
      if (!map) return;
      if (!pickMarkerRef.current) {
        pickMarkerRef.current = L.marker([pickedAt.lat, pickedAt.lng], { icon: buildDivIcon(L, "pin", true), draggable: !!onPick }).addTo(map);
        if (onPick) {
          pickMarkerRef.current.on("dragend", (ev: any) => {
            const c = ev.target.getLatLng();
            onPick({ lat: c.lat, lng: c.lng });
          });
        }
      } else {
        pickMarkerRef.current.setLatLng([pickedAt.lat, pickedAt.lng]);
      }
      map.setView([pickedAt.lat, pickedAt.lng], Math.max(map.getZoom(), 14), { animate: true });
    })();
  }, [pickedAt, ready, onPick]);

  return (
    <div className={`relative overflow-hidden rounded-3xl ring-1 ring-border/60 shadow-card ${className}`} style={{ height }}>
      <div ref={elRef} className="absolute inset-0 h-full w-full bg-primary-soft/40" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-primary-soft/40 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="animate-pulse">Loading map…</span>
        </div>
      )}
    </div>
  );
}
