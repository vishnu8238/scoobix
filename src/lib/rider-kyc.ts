import { createRecord, listTable, patchRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";
import { 
  fetchDocs, 
  submitDoc, 
  DOC_CATALOG, 
  VerifySubject, 
  mergeDocs, 
  summarize, 
  syncSubjectStatus,
  Actor
} from "./verification-api";

export async function getRiderProfile(userId: string) {
  const rows = await listTable<any>("drivers", { user_id: `eq.${userId}`, limit: 1 });
  return rows[0] || null;
}

export async function createRiderProfile(userId: string, data: {
  name: string;
  phone: string;
  vehicle_type: string;
  license_number: string;
  vehicle_number?: string;
}) {
  if (!userId) throw new Error("User identity required for profile creation");

  // Idempotent check
  const existing = await getRiderProfile(userId);
  if (existing) return existing;

  // Use the exact authoritative UUID from the session
  // authoritative column mapping confirmed via schema inspection
  const payload = {
    id: newUuid(),
    user_id: userId,
    name: data.name,
    phone: data.phone,
    vehicle_type: data.vehicle_type,
    license_number: data.license_number,
    vehicle_number: data.vehicle_number || null,
    verification_status: "pending",
    docs_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log("[RIDER_KYC] Creating rider profile with user_id:", userId);
  return createRecord("drivers", payload);
}

export async function submitRiderKycDoc(
  driverId: string, 
  docType: string, 
  fileUrl: string, 
  fileName: string,
  actor: Actor
) {
  const def = DOC_CATALOG.rider.find(d => d.type === docType);
  if (!def) throw new Error(`Invalid document type: ${docType}`);

  const docs = await fetchDocs("rider", driverId);
  const existing = docs.find(d => d.doc_type === docType) || null;

  return submitDoc("rider", driverId, def, {
    file_url: fileUrl,
    file_name: fileName
  }, existing, actor);
}

export async function finalizeRiderKycSubmission(driverId: string) {
  return syncSubjectStatus("rider", driverId);
}
