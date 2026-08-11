import { APIProvider } from "@vis.gl/react-google-maps";
import { ReactNode, useEffect, useState } from "react";
import { getGoogleMapsApiKey } from "@/lib/maps-config.functions";

/**
 * Shared Google Maps provider wrapper.
 * Fetches the API key from the server to bypass VITE_ prefix restrictions
 * and ensure the key is always available from the environment.
 */
export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if it's already in the env (e.g. if configured via build settings)
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) {
      setApiKey(envKey);
      setLoading(false);
      return;
    }

    // Otherwise fetch from server
    getGoogleMapsApiKey()
      .then((key) => {
        if (key) {
          setApiKey(key);
        }
      })
      .catch(() => {
        // Silently fail, the UI will handle the missing apiKey
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
    <APIProvider apiKey={apiKey} libraries={["places", "marker", "geometry"]}>
      {children}
    </APIProvider>
  );
}
