/**
 * Phase 2 map-provider abstraction: Google remains the active implementation; preserve provider-neutral consumer contracts.
 */
import { ReactNode } from "react";
import { GoogleMapsProvider } from "./GoogleMapsProvider";

interface MapProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
  onStatusChange?: (status: "loading" | "ready" | "error") => void;
}

export function MapProvider({ children, fallback, onStatusChange }: MapProviderProps) {
  // Delegate to existing Google implementation
  return (
    <GoogleMapsProvider fallback={fallback} onStatusChange={onStatusChange}>
      {children}
    </GoogleMapsProvider>
  );
}
