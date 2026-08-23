/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import type { LatLng } from "../geo";

export interface Coordinate extends LatLng {}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
  locality?: string;
  city?: string;
  postalCode?: string;
}

export interface RouteLeg {
  distanceMetres: number;
  durationSeconds: number;
}

export interface RouteResult {
  coords: Coordinate[];
  distanceKm: number;
  durationMins: number;
  legs: RouteLeg[];
}

export type TravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

export interface MapsServiceAdapter {
  searchPlaces(query: string, near?: Coordinate): Promise<GeocodeResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  routeBetween(from: Coordinate, to: Coordinate, mode?: TravelMode): Promise<RouteResult | null>;
  init(): Promise<any>;
}

export type MapMarkerKind = "restaurant" | "customer" | "rider" | "pickup" | "drop" | "pin";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: MapMarkerKind;
  label?: string;
}

export interface MapPolygon {
  id: string;
  points: Coordinate[];
  color?: string;
  label?: string;
}

export interface MapPolyline {
  id: string;
  points: Coordinate[];
  color?: string;
  weight?: number;
  dash?: boolean;
}
