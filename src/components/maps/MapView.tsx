/**
 * Map entry point. Map libraries are browser-only, so they are loaded
 * lazily after hydration and never evaluated during server rendering.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import type { MapMarker, MapPolygon, MapPolyline, Coordinate, LiveTrackingViewProps } from "@/lib/maps/contracts";

const MapLibreMap = lazy(() => import("./maplibre/MapLibreMap").then((m) => ({ default: m.MapLibreMap })));
const MapLibreOrderTracking = lazy(() =>
  import("./maplibre/MapLibreOrderTracking").then((m) => ({ default: m.MapLibreOrderTracking })),
);

interface MapViewProps {
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
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function Placeholder({ height = 260, className = "" }: { height?: number | string; className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-muted ring-1 ring-border/60 ${className}`} style={{ height }} />;
}

export function MapView(props: MapViewProps) {
  const mounted = useMounted();
  const ph = <Placeholder height={props.height} className={props.className} />;
  if (!mounted) return ph;
  return <Suspense fallback={ph}><MapLibreMap {...props} /></Suspense>;
}

export function LiveTrackingView(props: LiveTrackingViewProps) {
  const mounted = useMounted();
  const ph = <Placeholder height={320} />;
  if (!mounted) return ph;
  return <Suspense fallback={ph}><MapLibreOrderTracking {...props} /></Suspense>;
}
