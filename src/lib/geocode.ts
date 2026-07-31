/**
 * Real geocoding helpers (OpenStreetMap Nominatim).
 *
 * Used for:
 *  - reverse geocoding the device GPS fix into a human address
 *  - forward search of an area / street / landmark typed by the user
 *
 * No API key required. Requests are throttled by the browser and results are
 * cached in-memory for the session.
 */

export type GeoPlace = {
  label: string;
  lat: number;
  lng: number;
};

import { cached } from "./request-cache";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
/** Geocoding answers are effectively static — cache them for a week, on disk. */
const GEO_TTL = 7 * 24 * 3600;
/** Routes change with traffic-free OSRM only by geometry — 1h is plenty. */
const ROUTE_TTL = 3600;

function shortLabel(addr: Record<string, string> | undefined, fallback: string): string {
  if (!addr) return fallback;
  const line1 = [addr.house_number, addr.road || addr.pedestrian || addr.neighbourhood]
    .filter(Boolean)
    .join(" ");
  const area = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district;
  const city = addr.city || addr.town || addr.state_district || addr.county || addr.state;
  const parts = [line1 || area, area && area !== line1 ? undefined : undefined, city].filter(Boolean) as string[];
  const uniq = Array.from(new Set(parts));
  return uniq.length ? uniq.join(", ") : fallback;
}

/**
 * Turn coordinates into a real street-level address.
 * Coordinates are rounded to ~10 m so a jittering GPS fix or a map drag never
 * re-queries Nominatim for what is effectively the same spot.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return cached(
    `geo:rev:${key}`,
    GEO_TTL,
    async () => {
      try {
        const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return fallback;
        const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
        return shortLabel(json.address, json.display_name?.split(",").slice(0, 3).join(",") || fallback);
      } catch {
        return fallback;
      }
    },
    { persist: true },
  );
}

/** Search for a place by free text. Returns up to 6 matches. Cached on disk. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<GeoPlace[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : "-";
  return cached(
    `geo:fwd:${nearKey}:${q}`,
    GEO_TTL,
    async () => {
      try {
        const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "6", q });
        if (near) {
          const d = 0.5;
          params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
        }
        const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, { headers: { Accept: "application/json" } });
        if (!res.ok) return [];
        const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        return rows.map((r) => ({
          label: r.display_name.split(",").slice(0, 4).join(", "),
          lat: Number(r.lat),
          lng: Number(r.lon),
        }));
      } catch {
        return [];
      }
    },
    { persist: true },
  );
}

export type GeoRoute = {
  /** [lat, lng] pairs for a Leaflet polyline. */
  coords: [number, number][];
  distanceKm: number;
  durationMins: number;
};

/**
 * Driving route between two points via public OSRM. Cached per rounded
 * origin/destination pair, so a rider screen polling every few seconds
 * recalculates only when the pickup or drop actually changes.
 */
export async function routeBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<GeoRoute | null> {
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}->${to.lat.toFixed(3)},${to.lng.toFixed(3)}`;
  return cached(
    `geo:route:${key}`,
    ROUTE_TTL,
    async () => {
      try {
        const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          routes?: Array<{ distance: number; duration: number; geometry?: { coordinates: [number, number][] } }>;
        };
        const r = json.routes?.[0];
        if (!r) return null;
        return {
          coords: (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
          distanceKm: Math.round((r.distance / 1000) * 10) / 10,
          durationMins: Math.round(r.duration / 60),
        };
      } catch {
        return null;
      }
    },
    { persist: true },
  );
}

