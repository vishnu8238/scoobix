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
  const [driver] = await listTable<ExtendedDriver>("drivers", { id: `eq.${driverId}`, limit: 1 });
  if (!driver) return null;

  if (driver.user_id) {
    const [user] = await listTable<any>("users", { id: `eq.${driver.user_id}`, limit: 1 });
    if (user) {
      driver.email = user.email;
      driver.name = user.name;
      driver.phone = user.phone;
    }
  }

  const kycDocs = await fetchDocs("rider", driverId);
  const summary = summarize("rider", kycDocs);
  driver.kyc_status = summary.complete ? "verified" : summary.blocked ? "rejected" : summary.underReview ? "under_review" : "pending";
  driver.docs_verified = summary.complete;

  const [bank] = await listTable<any>("verification_api" as any, { 
    subject_id: `eq.${driverId}`, 
    doc_type: "eq.bank_account",
    limit: 1
  } as any);
  if (bank) {
    driver.bank_verified = bank.status === "verified";
    driver.bank_account = bank.doc_number;
  }


  return driver;
}

export async function updateDriverStatus(driverId: string, status: string, reason?: string, adminId?: string) {
  await patchRecord("drivers", driverId, { account_status: status });
  
  if (adminId) {
    await createRecord("loyalty_audit_logs", {
      entity: "rider",
      entity_id: driverId,
      action: `status_change_${status.toLowerCase()}`,
      new_value: { status, reason },
      admin_id: adminId,
      timestamp: new Date().toISOString()
    });
  }
}

export async function fetchDriverOrders(driverId: string, params: Record<string, any> = {}) {
  return listTable<any>("orders", { driver_id: `eq.${driverId}`, order: "created_at.desc", limit: 50, ...params });
}

export async function fetchDriverPayouts(driverId: string) {
  return listTable<any>("transfers", { recipient_id: `eq.${driverId}`, recipient_type: "eq.rider", order: "created_at.desc" });
}

export async function fetchDriverAttendance(driverId: string) {
  // Placeholder for attendance table if it exists
  return [];
}
