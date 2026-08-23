/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import { GoogleMap } from "./GoogleMap";
import { GoogleOrderTracking } from "./GoogleOrderTracking";
import type { MapMarker, MapPolygon, MapPolyline, Coordinate, LiveTrackingViewProps } from "@/lib/maps/contracts";

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

export function MapView(props: MapViewProps) {
  // Delegate to existing Google implementation
  return <GoogleMap {...props} />;
}

export function LiveTrackingView(props: LiveTrackingViewProps) {
  // Delegate to existing Google implementation
  return <GoogleOrderTracking {...props} />;
}
