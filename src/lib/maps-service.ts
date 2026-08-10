import { cached } from "./request-cache";
import type { LatLng } from "./geo";

const GEO_TTL = 7 * 24 * 3600;
const ROUTE_TTL = 3600;

/**
 * Shared Google Maps client-side utilities.
 * These require the Google Maps JS SDK to be loaded.
 */

export type GeoPlace = {
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
};

export type GeoRoute = {
  coords: LatLng[];
  distanceKm: number;
  durationMins: number;
};

/**
 * Search for places using Google Places Autocomplete.
 */
export async function searchPlaces(query: string, near?: LatLng): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  return cached(
    `google:places:${q}:${near?.lat.toFixed(2)},${near?.lng.toFixed(2)}`,
    GEO_TTL,
    async () => {
      if (!window.google?.maps?.places) {
        console.warn("Google Maps Places library not loaded");
        return [];
      }

      const service = new google.maps.places.AutocompleteService();
      const predictions = await service.getPlacePredictions({
        input: q,
        locationBias: near ? { center: near, radius: 5000 } : undefined,
      });

      if (!predictions?.predictions) return [];

      const placesService = new google.maps.places.PlacesService(document.createElement("div"));
      
      const details = await Promise.all(
        predictions.predictions.slice(0, 6).map(async (p) => {
          return new Promise<GeoPlace | null>((resolve) => {
            placesService.getDetails({ placeId: p.place_id, fields: ["geometry", "formatted_address"] }, (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                resolve({
                  label: place.formatted_address || p.description,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                  placeId: p.place_id,
                });
              } else {
                resolve(null);
              }
            });
          });
        })
      );

      return details.filter((d): d is GeoPlace => d !== null);
    }
  );
}

/**
 * Reverse geocode coordinates to an address using Google Geocoding API.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  return cached(
    `google:rev:${key}`,
    GEO_TTL,
    async () => {
      if (!window.google?.maps?.Geocoder) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });

      if (response.results && response.results[0]) {
        // Return a shorter version of the address if possible
        const result = response.results[0];
        return result.formatted_address;
      }

      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  );
}

/**
 * Calculate route between two points using Google Routes Service (Directions API).
 */
export async function routeBetween(from: LatLng, to: LatLng): Promise<GeoRoute | null> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  
  return cached(
    `google:route:${key}`,
    ROUTE_TTL,
    async () => {
      if (!window.google?.maps?.DirectionsService) {
        return null;
      }

      const service = new google.maps.DirectionsService();
      try {
        const result = await service.route({
          origin: from,
          destination: to,
          travelMode: google.maps.TravelMode.DRIVING,
        });

        const route = result.routes[0];
        const leg = route.legs[0];

        if (!route || !leg) return null;

        return {
          coords: route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })),
          distanceKm: Math.round((leg.distance?.value || 0) / 100) / 10,
          durationMins: Math.round((leg.duration?.value || 0) / 60),
        };
      } catch (err) {
        console.error("Google Directions error:", err);
        return null;
      }
    }
  );
}
