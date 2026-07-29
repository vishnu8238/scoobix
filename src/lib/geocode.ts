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

const NOMINATIM = "https://nominatim.openstreetmap.org";
const reverseCache = new Map<string, string>();

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

/** Turn coordinates into a real street-level address. Falls back to coords. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;
  const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const label = shortLabel(json.address, json.display_name?.split(",").slice(0, 3).join(",") || fallback);
    reverseCache.set(key, label);
    return label;
  } catch {
    return fallback;
  }
}

/** Search for a place by free text. Returns up to 6 matches. */
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      q,
    });
    if (near) {
      const d = 0.5;
      params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    }
    const res = await fetch(`${NOMINATIM}/search?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string; address?: Record<string, string> }>;
    return rows.map((r) => ({
      label: r.display_name.split(",").slice(0, 4).join(", "),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  } catch {
    return [];
  }
}
