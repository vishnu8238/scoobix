/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import { googleMapsAdapter } from "./maps/google-adapter";
import type { Coordinate, GeocodeResult, RouteResult, TravelMode } from "./maps/contracts";
import type { LatLng } from "./geo";

// Re-export types for backward compatibility
export type { GeocodeResult as GeoPlace, RouteResult as GeoRoute };

/**
 * Search for places using the active map provider.
 */
export async function searchPlaces(query: string, near?: LatLng): Promise<GeocodeResult[]> {
  return googleMapsAdapter.searchPlaces(query, near);
}

/**
 * Reverse geocode coordinates using the active map provider.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return googleMapsAdapter.reverseGeocode(lat, lng);
}

/**
 * Calculate route between two points using the active map provider.
 */
export async function routeBetween(from: LatLng, to: LatLng, mode: TravelMode = "DRIVING"): Promise<RouteResult | null> {
  return googleMapsAdapter.routeBetween(from, to, mode);
}

/**
 * Ensures map provider SDK is loaded and ready.
 */
export async function initGoogleMaps(): Promise<any> {
  return googleMapsAdapter.init();
}
