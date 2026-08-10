// Mock geo helpers. Deterministic lat/lng for restaurants and customer pins
// so the same restaurant always lands at the same spot on the map.
// Backend swap point: replace these with real coords from the API.

export type LatLng = { lat: number; lng: number };

// Bengaluru as the base city for all demo coordinates.
export const CITY_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

// Default "home" delivery location used across the customer + rider screens.
export const DEFAULT_CUSTOMER: LatLng = { lat: 12.9784, lng: 77.6408 };

// Stable hash → 0..1
function hash01(s: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Deterministic coords for a restaurant id, ~within 4km of city center. */
export function restaurantCoords(id: string): LatLng {
  const dLat = (hash01(id, 1) - 0.5) * 0.06; // ~±3.3 km
  const dLng = (hash01(id, 2) - 0.5) * 0.06;
  return { lat: CITY_CENTER.lat + dLat, lng: CITY_CENTER.lng + dLng };
}

/** Deterministic coords for a customer / address line. */
export function addressCoords(line: string): LatLng {
  const dLat = (hash01(line, 11) - 0.5) * 0.05;
  const dLng = (hash01(line, 22) - 0.5) * 0.05;
  return { lat: DEFAULT_CUSTOMER.lat + dLat, lng: DEFAULT_CUSTOMER.lng + dLng };
}

/** Linear interpolation along a great-circle approximation (fine for short distances). */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const u = Math.max(0, Math.min(1, t));
  return { lat: a.lat + (b.lat - a.lat) * u, lng: a.lng + (b.lng - a.lng) * u };
}


/** Haversine distance in KM between two points. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in KM
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * (Math.PI / 180)) *
      Math.cos(b.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

/** Check if a point is inside a polygon using ray-casting. */
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = yi > point.lng !== yj > point.lng && point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Map an order status to 0..1 progress for the rider marker. */
export function statusToProgress(status: string): number {
  switch (status) {
    case "PLACED": return 0.05;
    case "ACCEPTED": return 0.1;
    case "PREPARING": return 0.18;
    case "READY": return 0.3;
    case "PICKED_UP": return 0.5;
    case "ON_THE_WAY": return 0.8;
    case "DELIVERED": return 1;
    default: return 0;
  }
}


