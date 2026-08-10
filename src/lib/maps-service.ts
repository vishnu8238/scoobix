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
      const g = (window as any).google;
      if (!g?.maps?.places) {
        console.warn("Google Maps Places library not loaded");
        return [];
      }

      const service = new g.maps.places.AutocompleteService();
      try {
        const predictionsRes = await service.getPlacePredictions({
          input: q,
          locationBias: near ? { center: near, radius: 5000 } : undefined,
        });

        const predictions = predictionsRes.predictions;
        if (!predictions || predictions.length === 0) return [];

        const placesService = new g.maps.places.PlacesService(document.createElement("div"));
        
        const details = await Promise.all(
          predictions.slice(0, 6).map(async (p: any) => {
            return new Promise<GeoPlace | null>((resolve) => {
              placesService.getDetails({ placeId: p.place_id, fields: ["geometry", "formatted_address"] }, (place: any, status: any) => {
                if (status === g.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
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
      } catch (err) {
        console.error("Google Places error:", err);
        return [];
      }
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
      const g = (window as any).google;
      if (!g?.maps?.Geocoder) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      const geocoder = new g.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ location: { lat, lng } });

        if (response.results && response.results[0]) {
          return response.results[0].formatted_address;
        }
      } catch (err) {
        console.error("Google Geocoding error:", err);
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
      const g = (window as any).google;
      if (!g?.maps?.DirectionsService) {
        return null;
      }

      const service = new g.maps.DirectionsService();
      try {
        const result = await service.route({
          origin: from,
          destination: to,
          travelMode: g.maps.TravelMode.DRIVING,
        });

        const route = result.routes[0];
        const leg = route.legs[0];

        if (!route || !leg) return null;

        return {
          coords: route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() })),
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

