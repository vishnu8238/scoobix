import { haversineDistance, isPointInPolygon, type LatLng } from "./geo";
import { listTable, patchRecord } from "./insforge-crud";

/**
 * High-precision delivery resolution.
 */

export async function resolveZoneForLocation(lat: number, lng: number) {
  const loc: LatLng = { lat, lng };
  // Fallback to fetchZones if listTable fails or table is missing
  const zones = await listTable<any>("logistics_zones", { 
    select: "id,name,status",
    status: "eq.ACTIVE" 
  }).catch(() => []);
  
  for (const zone of zones) {
    if (zone.boundary?.type === "Polygon" && zone.boundary.coordinates?.[0]) {
      const polygon: LatLng[] = zone.boundary.coordinates[0].map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
      if (isPointInPolygon(loc, polygon)) {
        // Now check subzones within this zone
        const subzones = await listTable<any>("subzones", { 
          select: "id,name,status",
          zone_id: `eq.${zone.id}`, 
          status: "eq.ACTIVE" 
        }).catch(() => []);
        for (const sz of subzones) {
          if (sz.boundary?.type === "Polygon" && sz.boundary.coordinates?.[0]) {
            const szPolygon: LatLng[] = sz.boundary.coordinates[0].map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
            if (isPointInPolygon(loc, szPolygon)) {
              return { zoneId: zone.id, subzoneId: sz.id };
            }
          }
        }
        return { zoneId: zone.id, subzoneId: null };
      }
    }
  }
  return null;
}

export async function syncRestaurantZone(restaurantId: string, lat: number, lng: number) {
  const resolution = await resolveZoneForLocation(lat, lng);
  if (resolution) {
    // zone_id removed from restaurants schema
    return resolution;
  }
  return null;
}

export async function syncRiderZone(riderId: string, lat: number, lng: number) {
  const resolution = await resolveZoneForLocation(lat, lng);
  if (resolution) {
    await patchRecord("drivers", riderId, {
      zone_id: resolution.zoneId,
      subzone_id: resolution.subzoneId
    });
    return resolution;
  }
  return null;
}
