import { APIProvider } from "@vis.gl/react-google-maps";
import { ReactNode } from "react";

/**
 * Shared Google Maps provider wrapper.
 * Requires VITE_GOOGLE_MAPS_API_KEY environment variable.
 */
export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  
  if (!apiKey) {
    console.warn("VITE_GOOGLE_MAPS_API_KEY is missing. Maps will not load.");
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/20 p-6 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl">
        <p className="font-medium">Google Maps API Key Missing</p>
        <p className="text-sm mt-2">Please configure VITE_GOOGLE_MAPS_API_KEY in your environment.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places", "marker", "geometry"]}>
      {children}
    </APIProvider>
  );
}
