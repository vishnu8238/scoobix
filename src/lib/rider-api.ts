import { createRecord, listTable, patchRecord } from "./insforge-crud";

/**
 * Persist rider availability (online/offline status) to the backend.
 * Logistics portal uses this to show real-time rider status.
 */
export async function setRiderAvailability(driverId: string, online: boolean) {
  if (!driverId) return null;
  
  console.log(`[RIDER_API] Setting availability for ${driverId} to ${online ? 'ONLINE' : 'OFFLINE'}`);
  
  try {
    const res = await patchRecord("drivers", driverId, { 
      online_status: online,
      last_online_at: online ? new Date().toISOString() : undefined,
      last_offline_at: !online ? new Date().toISOString() : undefined
    });
    
    if (res) {
      console.log(`[RIDER_API] Availability sync success for ${driverId}`);
      return res;
    }
    throw new Error("Patch returned empty result");
  } catch (err: any) {
    console.error(`[RIDER_API] Availability sync failed for ${driverId}:`, err.message);
    throw err;
  }
}

/**
 * Log an emergency event (SOS) initiated by the rider.
 * Admin and Logistics portals can see these in real-time.
 */
export async function logEmergencyEvent(driverId: string, type: string, lat?: number, lng?: number) {
  if (!driverId) return null;
  
  console.log(`[RIDER_API] LOGGING SOS EVENT: ${type} for driver ${driverId}`);
  
  try {
    const res = await createRecord("emergency_events", {
      driver_id: driverId,
      event_type: type,
      latitude: lat,
      longitude: lng,
      status: "OPEN",
      created_at: new Date().toISOString()
    });
    
    if (res) {
      console.log(`[RIDER_API] SOS event logged:`, res);
      return res;
    }
    throw new Error("SOS log failed");
  } catch (err: any) {
    console.error(`[RIDER_API] SOS logging failed:`, err.message);
    throw err;
  }
}

/**
 * Fetch rider-specific preferences.
 */
export async function getRiderPreferences(driverId: string) {
  try {
    const rows = await listTable<any>("rider_preferences", { driver_id: `eq.${driverId}`, limit: 1 });
    return rows[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Update rider-specific preferences.
 */
export async function updateRiderPreferences(driverId: string, prefs: Record<string, any>) {
  try {
    const existing = await getRiderPreferences(driverId);
    if (existing) {
      return patchRecord("rider_preferences", existing.id, prefs);
    } else {
      return createRecord("rider_preferences", { driver_id: driverId, ...prefs });
    }
  } catch (err) {
    console.error(`[RIDER_API] Preference update failed:`, err);
    throw err;
  }
}
