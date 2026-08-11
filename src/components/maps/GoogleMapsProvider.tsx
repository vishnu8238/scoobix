import { APIProvider } from "@vis.gl/react-google-maps";
import { ReactNode, useEffect, useState } from "react";
import { getGoogleMapsApiKey } from "@/lib/maps-config.functions";

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) {
      console.log("[MAPS_DEBUG] Using build-time VITE_GOOGLE_MAPS_API_KEY:", envKey.slice(0, 6) + "...");
      setApiKey(envKey);
      setLoading(false);
      return;
    }

    console.log("[MAPS_DEBUG] Fetching API key from server...");
    getGoogleMapsApiKey()
      .then((key) => {
        if (key) {
          console.log("[MAPS_DEBUG] Server API key received:", key.slice(0, 6) + "...");
          setApiKey(key);
        } else {
          console.error("[MAPS_DEBUG] Server returned EMPTY API key.");
        }
      })
      .catch((err) => {
        console.error("[MAPS_DEBUG] Failed to fetch server API key:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/10 border-2 border-dashed border-border rounded-3xl min-h-[200px]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/20 p-6 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl min-h-[200px]">
        <p className="font-medium text-destructive">Google Maps API Key Missing</p>
        <p className="text-xs mt-2">
          Please configure <strong>GOOGLE_MAPS_API_KEY</strong> in Lovable Cloud Secrets.
        </p>
      </div>
    );
  }

  return (
    <APIProvider 
      apiKey={apiKey} 
      libraries={["places", "marker", "geometry"]}
      onLoad={() => console.log("[MAPS_DEBUG] APIProvider script loaded successfully")}
    >
      {children}
    </APIProvider>
  );
}
