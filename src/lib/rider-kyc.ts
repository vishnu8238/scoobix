import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

/**
 * Rider Profile Persistence (External to 'drivers' table)
 * 
 * We use 'rider_profiles' to store onboarding data because the 'drivers' table
 * columns are unreliable in the production schema cache.
 */
export const RIDER_PROFILE_TABLE = "rider_profiles";

export type RiderProfileData = {
  name: string;
  phone: string;
  vehicle_type: string;
  license_number: string;
  vehicle_number?: string;
};

/**
 * Idempotent Rider Profile resolution.
 */
export async function createRiderProfile(userId: string, data: RiderProfileData) {
  if (!userId) throw new Error("User ID is required for rider profile creation");

  // 1. Check if profile already exists for this user
  const existing = await listTable<any>(RIDER_PROFILE_TABLE, { 
    user_id: `eq.${userId}`, 
    limit: 1 
  }).catch(() => []);

  if (existing && existing.length > 0) {
    return patchRecord(RIDER_PROFILE_TABLE, existing[0].id, {
      ...data,
      updated_at: new Date().toISOString()
    });
  }

  // 2. Ensure a driver record exists first (identity anchor)
  let driverRecord = await listTable<any>("drivers", { 
    user_id: `eq.${userId}`, 
    limit: 1,
    select: "id"
  }).catch(() => []);

  let driverId: string;
  if (!driverRecord || driverRecord.length === 0) {
    const created = await createRecord<any>("drivers", {
      id: newUuid(),
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    driverId = created?.id || newUuid();
  } else {
    driverId = driverRecord[0].id;
  }

  // 3. Create the profile record
  const payload = {
    id: newUuid(),
    user_id: userId,
    driver_id: driverId,
    ...data,
    verification_status: "pending",
    docs_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return createRecord(RIDER_PROFILE_TABLE, payload);
}

export async function getRiderProfile(userId: string) {
  const rows = await listTable<any>(RIDER_PROFILE_TABLE, { 
    user_id: `eq.${userId}`, 
    limit: 1 
  });
  return rows[0] || null;
}
