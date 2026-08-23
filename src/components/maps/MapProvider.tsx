/**
 * Phase 3 map-provider abstraction: MapLibre is the active renderer; 
 * Google remains the active provider for geocoding and routing services.
 */
import { ReactNode } from "react";
import { GoogleMapsProvider } from "./GoogleMapsProvider";

interface MapProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
  onStatusChange?: (status: "loading" | "ready" | "error") => void;
}

export function MapProvider({ children, fallback, onStatusChange }: MapProviderProps) {
  /**
   * We still mount GoogleMapsProvider globally because our Geo services (search, routing) 
   * in maps-service.ts still depend on the Google Maps JS SDK being initialized.
   */
  return (
    <GoogleMapsProvider fallback={fallback} onStatusChange={onStatusChange}>
      {children}
    </GoogleMapsProvider>
  );
}
