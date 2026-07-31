/**
 * Restaurant KYC verification.
 *
 * One row per (restaurant, document) in `restaurant_kyc`, plus an append-only
 * `kyc_audit_logs` trail for every submission and admin decision. A restaurant
 * cannot go live until every mandatory document is `verified`.
 */
import { createRecord, listTable, patchRecord } from "./insforge-crud";

export type KycStatus = "pending" | "verified" | "rejected" | "reupload";

export type KycDocType =
  | "gst"
  | "fssai"
  | "pan"
  | "bank_account"
  | "aadhaar"
  | "cancelled_cheque";

export type KycRow = {
  id: string;
  restaurant_id?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  file_url?: string | null;
  status?: string | null;
  mandatory?: boolean | null;
  remarks?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KycAuditRow = {
  id: string;
  restaurant_id?: string | null;
  kyc_id?: string | null;
  doc_type?: string | null;
  action?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  remarks?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at?: string | null;
};

export type KycDocDef = {
  type: KycDocType;
  label: string;
  hint: string;
  mandatory: boolean;
  numberLabel: string;
};

/** Catalogue of documents Scoobix collects. */
export const KYC_DOCS: KycDocDef[] = [
  { type: "fssai", label: "FSSAI licence", hint: "Food safety licence certificate", mandatory: true, numberLabel: "FSSAI number" },
  { type: "pan", label: "PAN card", hint: "Business or proprietor PAN", mandatory: true, numberLabel: "PAN number" },
  { type: "bank_account", label: "Bank account", hint: "Account number with IFSC", mandatory: true, numberLabel: "Account number" },
  { type: "cancelled_cheque", label: "Cancelled cheque", hint: "Proof of bank account", mandatory: true, numberLabel: "Cheque / reference no." },
  { type: "aadhaar", label: "Aadhaar", hint: "Owner identity proof", mandatory: true, numberLabel: "Aadhaar number" },
  { type: "gst", label: "GST certificate", hint: "Optional — only if GST registered", mandatory: false, numberLabel: "GSTIN" },
];

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  reupload: "Need re-upload",
};

export const KYC_STATUS_TONE: Record<KycStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  reupload: "bg-sky-100 text-sky-700",
};

export function normalizeStatus(s?: string | null): KycStatus {
  const v = (s ?? "pending").toLowerCase();
  return v === "verified" || v === "rejected" || v === "reupload" ? v : "pending";
}

export type Actor = { id?: string | null; name?: string | null; role?: string | null };

async function log(entry: Partial<KycAuditRow>) {
  await createRecord("kyc_audit_logs", { ...entry, created_at: new Date().toISOString() });
}

/** All KYC rows for a restaurant, newest first per document. */
export async function fetchKyc(restaurantId: string): Promise<KycRow[]> {
  if (!restaurantId) return [];
  return listTable<KycRow>("restaurant_kyc", {
    restaurant_id: `eq.${restaurantId}`,
    order: "created_at.asc",
    limit: 100,
  });
}

export async function fetchKycLogs(restaurantId: string): Promise<KycAuditRow[]> {
  if (!restaurantId) return [];
  return listTable<KycAuditRow>("kyc_audit_logs", {
    restaurant_id: `eq.${restaurantId}`,
    order: "created_at.desc",
    limit: 100,
  });
}

/** Merge stored rows with the catalogue so every document always has an entry. */
export function mergeDocs(rows: KycRow[]): { def: KycDocDef; row: KycRow | null }[] {
  return KYC_DOCS.map((def) => ({
    def,
    row: rows.find((r) => (r.doc_type ?? "").toLowerCase() === def.type) ?? null,
  }));
}

/** Restaurant/partner submission — always resets the doc to `pending`. */
export async function submitKycDoc(
  restaurantId: string,
  def: KycDocDef,
  data: { doc_number?: string | null; file_url?: string | null },
  existing: KycRow | null,
  actor: Actor = {},
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    restaurant_id: restaurantId,
    doc_type: def.type,
    doc_number: data.doc_number ?? existing?.doc_number ?? null,
    file_url: data.file_url ?? existing?.file_url ?? null,
    status: "pending",
    mandatory: def.mandatory,
    remarks: null,
    submitted_at: now,
    reviewed_at: null,
    reviewed_by: null,
    updated_at: now,
  };

  let kycId = existing?.id ?? null;
  if (existing?.id) {
    await patchRecord("restaurant_kyc", existing.id, payload);
  } else {
    const created = await createRecord<KycRow | KycRow[]>("restaurant_kyc", { ...payload, created_at: now });
    const row = Array.isArray(created) ? created[0] : created;
    kycId = row?.id ?? null;
  }

  await log({
    restaurant_id: restaurantId,
    kyc_id: kycId,
    doc_type: def.type,
    action: existing ? "resubmitted" : "submitted",
    from_status: existing ? normalizeStatus(existing.status) : null,
    to_status: "pending",
    actor_id: actor.id ?? null,
    actor_name: actor.name ?? null,
    actor_role: actor.role ?? "partner",
  });
}

/** Admin decision on a document. */
export async function reviewKycDoc(
  restaurantId: string,
  def: KycDocDef,
  existing: KycRow | null,
  status: KycStatus,
  remarks: string | null,
  actor: Actor = {},
): Promise<KycRow | null> {
  const now = new Date().toISOString();
  const patch = {
    status,
    remarks: remarks || null,
    reviewed_at: now,
    reviewed_by: actor.name ?? actor.id ?? "admin",
    updated_at: now,
  };

  let row: KycRow | null = existing;
  if (existing?.id) {
    await patchRecord("restaurant_kyc", existing.id, patch);
    row = { ...existing, ...patch };
  } else {
    const created = await createRecord<KycRow | KycRow[]>("restaurant_kyc", {
      restaurant_id: restaurantId,
      doc_type: def.type,
      mandatory: def.mandatory,
      created_at: now,
      ...patch,
    });
    row = (Array.isArray(created) ? created[0] : created) ?? null;
  }

  await log({
    restaurant_id: restaurantId,
    kyc_id: row?.id ?? null,
    doc_type: def.type,
    action: `marked_${status}`,
    from_status: existing ? normalizeStatus(existing.status) : null,
    to_status: status,
    remarks: remarks || null,
    actor_id: actor.id ?? null,
    actor_name: actor.name ?? null,
    actor_role: actor.role ?? "admin",
  });

  return row;
}

export type KycSummary = {
  verified: number;
  mandatoryTotal: number;
  mandatoryVerified: number;
  percent: number;
  /** True when every mandatory document is verified. */
  complete: boolean;
  pending: number;
  blocked: number;
};

export function summarizeKyc(rows: KycRow[]): KycSummary {
  const merged = mergeDocs(rows);
  const mandatory = merged.filter((m) => m.def.mandatory);
  const mandatoryVerified = mandatory.filter((m) => normalizeStatus(m.row?.status) === "verified").length;
  const verified = merged.filter((m) => normalizeStatus(m.row?.status) === "verified").length;
  const pending = merged.filter((m) => m.row && normalizeStatus(m.row.status) === "pending").length;
  const blocked = merged.filter((m) => {
    const s = normalizeStatus(m.row?.status);
    return m.row != null && (s === "rejected" || s === "reupload");
  }).length;
  return {
    verified,
    mandatoryTotal: mandatory.length,
    mandatoryVerified,
    percent: mandatory.length ? Math.round((mandatoryVerified / mandatory.length) * 100) : 0,
    complete: mandatory.length > 0 && mandatoryVerified === mandatory.length,
    pending,
    blocked,
  };
}

/** Convenience: is this restaurant KYC-clear for go-live? */
export async function isKycComplete(restaurantId: string): Promise<boolean> {
  if (!restaurantId) return false;
  return summarizeKyc(await fetchKyc(restaurantId)).complete;
}
