/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import type { 
  Coordinate, 
  GeocodeResult, 
  RouteResult, 
  TravelMode, 
  MapsServiceAdapter 
} from "./contracts";
import { cached } from "../request-cache";

const GEO_TTL = 7 * 24 * 3600;
const ROUTE_TTL = 3600;

export class GoogleMapsAdapter implements MapsServiceAdapter {
  async searchPlaces(query: string, near?: Coordinate): Promise<GeocodeResult[]> {
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
              return new Promise<GeocodeResult | null>((resolve) => {
                placesService.getDetails({ 
                  placeId: p.place_id, 
                  fields: ["geometry", "formatted_address", "address_components"] 
                }, (place: any, status: any) => {
                  if (status === g.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                    const components = place.address_components || [];
                    const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;
                    
                    resolve({
                      label: place.formatted_address || p.description,
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng(),
                      placeId: p.place_id,
                      locality: getComp("sublocality") || getComp("locality"),
                      city: getComp("administrative_area_level_2") || getComp("locality"),
                      postalCode: getComp("postal_code"),
                    });
                  } else {
                    resolve(null);
                  }
                });
              });
            })
          );

          return details.filter((d): d is GeocodeResult => d !== null);
        } catch (err) {
          console.error("Google Places error:", err);
          return [];
        }
      }
    );
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
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

          if (response.results && response.results.length > 0) {
            return this.extractReadableLabel(response.results);
          }
        } catch (err) {
          console.error("Google Geocoding error:", err);
        }

        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    );
  }

  private extractReadableLabel(results: any[]): string {
    if (!results || results.length === 0) return "";
    
    const bestResult = results.find(r => 
      r.types.includes("premise") || 
      r.types.includes("sublocality_level_1") ||
      r.types.includes("sublocality")
    ) || results[0];

    const components = bestResult.address_components || [];
    const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;
    
    const house = getComp("premise") || getComp("subpremise");
    const neighborhood = getComp("sublocality_level_1") || getComp("sublocality") || getComp("neighborhood");
    const locality = getComp("locality");
    
    if (house && neighborhood) return `${house}, ${neighborhood}`;
    if (neighborhood) return neighborhood;
    if (locality) return locality;
    
    return bestResult.formatted_address.split(",")[0];
  }

  async routeBetween(from: Coordinate, to: Coordinate, mode: TravelMode = "DRIVING"): Promise<RouteResult | null> {
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
            travelMode: g.maps.TravelMode[mode as keyof typeof g.maps.TravelMode] || g.maps.TravelMode.DRIVING,
          });

          const route = result.routes[0];
          const leg = route.legs[0];

          if (!route || !leg) return null;

          return {
            coords: route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() })),
            distanceKm: Math.round((leg.distance?.value || 0) / 100) / 10,
            durationMins: Math.round((leg.duration?.value || 0) / 60),
            legs: [{
              distanceMetres: leg.distance?.value || 0,
              durationSeconds: leg.duration?.value || 0,
            }]
          };
        } catch (err) {
          console.error("Google Directions error:", err);
          return null;
        }
      }
    );
  }

  async init(): Promise<any> {
    if (typeof window === "undefined") return null;
    const g = (window as any).google;
    if (g?.maps) return g;

    if ((window as any).googleMapsPromise) return (window as any).googleMapsPromise;

    (window as any).googleMapsPromise = new Promise((resolve) => {
      const check = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(check);
          resolve((window as any).google);
        }
      }, 100);
    });

    return (window as any).googleMapsPromise;
  }
}

export const googleMapsAdapter = new GoogleMapsAdapter();

// We will implement the LiveTracking implementation in a component file to keep this a clean logic adapter.
// But we add the symbols and paths here if needed for shared logic.
export const GoogleSymbolPaths = {
  CIRCLE: 0, // google.maps.SymbolPath.CIRCLE
  FORWARD_CLOSED_ARROW: 1, // google.maps.SymbolPath.FORWARD_CLOSED_ARROW
  BACKWARD_CLOSED_ARROW: 2, // google.maps.SymbolPath.BACKWARD_CLOSED_ARROW
};
