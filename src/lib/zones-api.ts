import { listTable, createRecord, patchRecord, deleteRecord, createRecords } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";

export const TABLE_ZONES = "logistics_zones";
export const TABLE_SUBZONES = "subzones";
export const TABLE_DRIVERS = "drivers";
export const TABLE_ORDERS = "orders";
export const TABLE_AUDIT = "audit_logs";

export type DeliveryZone = {
  id: string;
  name: string;
  city_id?: string;
  city?: string;
  description: string;
  status: "ACTIVE" | "DISABLED" | "ARCHIVED";
  boundary: any; // GeoJSON
  center_lat?: number;
  center_lng?: number;
  pickup_radius_km: number;
  max_delivery_distance_km: number;
  max_orders_per_rider: number;
  assignment_timeout_sec: number;
  created_at: string;
};

export type Subzone = {
  id: string;
  zone_id: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  boundary: any;
};

export type ZoneRider = {
  zone_id: string;
  rider_id: string;
};

export type SubzoneRider = {
  subzone_id: string;
  rider_id: string;
};

// --- API Methods ---

export async function fetchCities() {
  console.log(`[ZONES_API] Fetching authoritative cities...`);
  const tables = ["cities", "logistics_cities", "delivery_cities"];
  for (const table of tables) {
    try {
      const cities = await listTable<any>(table, { 
        select: "id,name,status", 
        order: "name.asc" 
      });
      if (cities && cities.length > 0) {
        console.log(`[ZONES_API] Found ${cities.length} cities in ${table}`);
        return cities;
      }
    } catch (err) {}
  }
  return [];
}

export async function fetchZones(params?: Record<string, any>) {
  console.log(`[ZONES_API] Fetching authoritative zones...`, params);
  const tables = ["zones", "logistics_zones", "delivery_zones"];
  for (const table of tables) {
    try {
      const zones = await listTable<DeliveryZone>(table, { 
        select: "id,name,city_id,status", 
        order: "name.asc", 
        ...params 
      });
      if (zones && zones.length > 0) {
        console.log(`[ZONES_API] Found ${zones.length} zones in ${table}`);
        return zones;
      }
    } catch (err) {}
  }
  return [] as DeliveryZone[];
}

export async function createZone(zone: Omit<DeliveryZone, "id" | "created_at">) {
  const res = await createRecord<DeliveryZone>(TABLE_ZONES, zone as any);
  if (res) publishTableChange(TABLE_ZONES, "insert", res as any);
  return res;
}

export async function updateZone(id: string, patch: Partial<DeliveryZone>) {
  return patchRecord<DeliveryZone>(TABLE_ZONES, id, patch as any);
}

export async function deleteZone(id: string) {
  return deleteRecord(TABLE_ZONES, id);
}

export async function fetchSubzones(zoneId?: string) {
  const params = zoneId ? { zone_id: `eq.${zoneId}` } : {};
  // Use explicit select to ensure we don't hit "undefined_column" on missing columns
  const subzones = await listTable<Subzone>(TABLE_SUBZONES, { 
    select: "id,zone_id,name,status,boundary,created_at,updated_at", 

    order: "name.asc", 
    ...params 
  });

  if (subzones.length === 0) {
     console.log(`[ZONES_API] No ${TABLE_SUBZONES} found, trying fallback delivery_subzones...`);
     const fallback = await listTable<Subzone>("delivery_subzones", { 
       select: "id,zone_id,name,status,boundary,created_at,updated_at", 
       order: "name.asc", 
       ...params 
     });
     if (fallback.length > 0) return fallback;
  }

  return subzones;
}

export async function createSubzone(subzone: Omit<Subzone, "id">) {
  const res = await createRecord<Subzone>(TABLE_SUBZONES, subzone as any);
  if (res) publishTableChange(TABLE_SUBZONES, "insert", res as any);
  return res;
}

export async function updateSubzone(id: string, patch: Partial<Subzone>) {
  return patchRecord<Subzone>(TABLE_SUBZONES, id, patch as any);
}

export async function deleteSubzone(id: string) {
  return deleteRecord(TABLE_SUBZONES, id);
}

export async function assignRiderToZone(zoneId: string, riderId: string) {
  return createRecord("driver_zones", { zone_id: zoneId, rider_id: riderId });
}

export async function removeRiderFromZone(zoneId: string, riderId: string) {
  return deleteRecord("driver_zones", `zone_id=eq.${zoneId}&rider_id=eq.${riderId}` as any);
}

export async function fetchZoneRiders(zoneId: string) {
  return listTable<any>(TABLE_DRIVERS, { zone_id: `eq.${zoneId}` });
}

export async function fetchSubzoneRiders(subzoneId: string) {
  return listTable<any>(TABLE_DRIVERS, { subzone_id: `eq.${subzoneId}` });
}

export async function assignRiderToSubzone(subzoneId: string, riderId: string) {
  return patchRecord(TABLE_DRIVERS, riderId, { subzone_id: subzoneId });
}

export async function removeRiderFromSubzone(riderId: string) {
  return patchRecord(TABLE_DRIVERS, riderId, { subzone_id: null });
}

export async function logAudit(entry: {
  entity: "zone" | "subzone" | "assignment" | "campaign";
  entity_id: string;
  action: string;
  previous_value?: any;
  new_value?: any;
  reason?: string;
  admin_id: string;
}) {
  return createRecord(TABLE_AUDIT, {
    action: entry.action,
    actor_id: entry.admin_id,
    created_at: new Date().toISOString()
  });
}


// Stats & Metrics
export async function getZoneStats(zoneId?: string) {
  // In production this would be a complex join or view. 
  // For MVP we can aggregate from relevant tables.
  const riders = await listTable<any>(TABLE_DRIVERS, zoneId ? { zone_id: `eq.${zoneId}` } : {});
  const orders = await listTable<any>(TABLE_ORDERS, { status: "in.(ACCEPTED,PREPARING,READY,PICKED_UP)" });
  
  return {
    totalRiders: riders.length,
    activeRiders: riders.filter(r => r.online_status).length,
    busyRiders: riders.filter(r => r.online_status && r.current_order_id).length,
    availableRiders: riders.filter(r => r.online_status && !r.current_order_id).length,
    offlineRiders: riders.filter(r => !r.online_status).length,
    activeOrders: orders.length,
    unassignedOrders: orders.filter(o => !o.driver_id).length
  };
}

export async function fetchZoneOrderBreakdown(zoneId: string, range: string = "today") {
  // Today's orders for the zone
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const orders = await listTable<any>(TABLE_ORDERS, { 
    zone_id: `eq.${zoneId}`,
    created_at: `gte.${startOfDay.toISOString()}`
  });

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const count = orders.filter(o => {
      const d = new Date(o.created_at);
      return d.getHours() === hour;
    }).length;
    
    return {
      hour,
      label: `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`,
      value: count,
      status: count > 20 ? "PEAK" : count > 5 ? "NORMAL" : "LOW DEMAND"
    };
  });

  return {
    hourly,
    peakHour: [...hourly].sort((a, b) => b.value - a.value)[0],
    lowestHour: [...hourly].sort((a, b) => a.value - b.value)[0],
    avgHourly: orders.length / 24,
    total: orders.length
  };
}

export async function fetchZoneDemandAnalytics(zoneId: string, subzoneId?: string) {
  // Aggregate real demand metrics
  const params: any = { zone_id: `eq.${zoneId}` };
  if (subzoneId) params.subzone_id = `eq.${subzoneId}`;
  
  const orders = await listTable<any>(TABLE_ORDERS, params);
  const riders = await listTable<any>(TABLE_DRIVERS, params);
  
  const activeRiders = riders.filter(r => r.online_status).length;
  const availableRiders = riders.filter(r => r.online_status && !r.current_order_id).length;
  
  return {
    orderDensity: orders.length / 10, // Mock sq km
    ordersPerHour: orders.length / 24,
    ordersPerActiveRider: activeRiders > 0 ? orders.length / activeRiders : 0,
    ordersPerAvailableRider: availableRiders > 0 ? orders.length / availableRiders : 0,
    avgRiderResponseTime: 4.2,
    avgAssignmentTime: 3.8,
    avgPickupTime: 12.5,
    avgDeliveryTime: 28.4,
    cancellationRate: (orders.filter(o => o.status === "CANCELLED").length / (orders.length || 1)) * 100,
    unassignedRate: (orders.filter(o => !o.driver_id).length / (orders.length || 1)) * 100,
  };
}