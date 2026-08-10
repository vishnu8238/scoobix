/**
 * Centralized Geocoding and Routing.
 * Standardized on Google Maps Platform.
 */

import { reverseGeocode as googleReverseGeocode, searchPlaces as googleSearchPlaces, routeBetween as googleRouteBetween } from "./maps-service";
import type { GeoPlace, GeoRoute } from "./maps-service";
import type { LatLng } from "./geo";

export type { GeoPlace, GeoRoute };

/**
 * Reverse geocode coordinates to an address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return googleReverseGeocode(lat, lng);
}

/**
 * Search for places by text.
 */
export async function searchPlaces(query: string, near?: LatLng): Promise<GeoPlace[]> {
  return googleSearchPlaces(query, near);
}

/**
 * Calculate driving route between two points.
 */
export async function routeBetween(from: LatLng, to: LatLng): Promise<GeoRoute | null> {
  return googleRouteBetween(from, to);
}
