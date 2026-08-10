import { createServerFn } from "@tanstack/react-start";

export const getGoogleMapsApiKey = createServerFn({ method: "GET" })
  .handler(async () => {
    // We check both names to be safe, but GOOGLE_API_KEY is the standard one we found.
    return process.env['GOOGLE_API_KEY'] || process.env['VITE_GOOGLE_MAPS_API_KEY'] || "";
  });
