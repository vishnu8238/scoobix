import { listTable, patchRecord, createRecord } from "./insforge-crud";
import { DriverRow } from "./driver-store";
import { KycRow, fetchDocs, summarize } from "./verification-api";

export interface ExtendedDriver extends DriverRow {
  email?: string;
  name?: string;
  phone?: string;
  gender?: string;
  age?: number;
  dob?: string;
  joining_date?: string;
  account_status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  kyc_status?: string;
  docs_verified?: boolean;
  bank_verified?: boolean;
  bank_account?: string;
  bank_name?: string;
  bank_ifsc?: string;
  bank_holder?: string;
  vehicle_model?: string;
  vehicle_rc_url?: string;
  insurance_status?: string;
  insurance_expiry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  language?: string;
  last_gps_update?: string;
  zone_name?: string;
  subzone_name?: string;
}

export async function fetchDriverDetails(driverId: string): Promise<ExtendedDriver | null> {
  // Use explicit select to avoid schema cache errors
  const [driver] = await listTable<ExtendedDriver>("drivers", { 
    id: `eq.${driverId}`, 
    limit: 1,
    select: "id,user_id,vehicle_type,vehicle_number,license_number,verification_status"
  }, { fresh: true });
  
  if (!driver) return null;

  // Resolve profile data from the user record if possible
  if (driver.user_id) {
    const [user] = await listTable<any>("users", { id: `eq.${driver.user_id}`, limit: 1 });
    if (user) {
      driver.email = user.email;
      driver.name = user.name;
      driver.phone = user.phone;
    }
    
    // Also try to find a rider_profile
    const [profile] = await listTable<any>("rider_profiles", { user_id: `eq.${driver.user_id}`, limit: 1 }).catch(() => []);
    if (profile) {
      driver.name = profile.name || driver.name;
      driver.phone = profile.phone || driver.phone;
      driver.vehicle_type = profile.vehicle_type || driver.vehicle_type;
      driver.vehicle_number = profile.vehicle_number || driver.vehicle_number;
      driver.license_number = profile.license_number || driver.license_number;
      driver.docs_verified = profile.docs_verified;
      driver.verification_status = profile.verification_status || driver.verification_status;
      // Additional rider_profiles fields
      driver.bank_name = profile.bank_name;
      driver.bank_account = profile.bank_account;
      driver.bank_ifsc = profile.bank_ifsc;
      driver.bank_holder = profile.bank_holder;
    }
  }

  const kycDocs = await fetchDocs("rider", driver.user_id || driverId);
  const summary = summarize("rider", kycDocs);
  driver.kyc_status = summary.complete ? "verified" : summary.blocked ? "rejected" : summary.underReview ? "under_review" : "pending";
  driver.docs_verified = summary.complete;

  return driver;
}

export async function updateDriverStatus(driverId: string, status: string, reason?: string, adminId?: string) {
  // Best-effort update to a metadata-style status or just update updated_at
  await patchRecord("drivers", driverId, {}).catch(() => null);
  
  if (adminId) {
    await createRecord("loyalty_audit_logs", {
      entity: "rider",
      entity_id: driverId,
      action: `status_change_${status.toLowerCase()}`,
      new_value: { status, reason },
      admin_id: adminId,
      timestamp: new Date().toISOString()
    }).catch(() => null);
  }
}

export async function fetchDriverOrders(driverId: string, params: Record<string, any> = {}) {
  return listTable<any>("orders", { driver_id: `eq.${driverId}`, order: "created_at.desc", limit: 50, ...params });
}

export async function fetchDriverPayouts(driverId: string) {
  // Authoritative payout ledger instead of 'transfers'
  return listTable<any>("driver_payout_periods", { 
    driver_id: `eq.${driverId}`, 
    order: "created_at.desc" 
  }).catch(() => []);
}
