/**
 * Scoobix verification / KYC engine — one implementation for every role.
 *
 * Storage:
 *   `restaurant_kyc`   one row per (subject_type, subject_id, doc_type)
 *   `kyc_audit_logs`   append-only trail of every submission and decision
 *
 * Subjects: restaurant (partner), rider (driver), manager (merchant manager).
 * A subject is "verified" only when every mandatory document is `verified`
 * and not expired. Reviews are admin-only for riders/managers; managers may
 * also review the restaurants assigned to them.
 */
import { createRecord, listTable, patchRecord } from "./insforge-crud";

export const VERIFICATION_TABLE = "restaurant_kyc";
export const VERIFICATION_LOG_TABLE = "kyc_audit_logs";

export type VerifySubject = "restaurant" | "rider" | "manager";

export type KycStatus = "pending" | "under_review" | "verified" | "rejected" | "reupload";

export type KycRow = {
  id: string;
  restaurant_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  doc_type?: string | null;
  doc_number?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  status?: string | null;
  mandatory?: boolean | null;
  remarks?: string | null;
  expires_at?: string | null;
  uploaded_by?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KycAuditRow = {
  id: string;
  restaurant_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
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
  type: string;
  label: string;
  hint: string;
  mandatory: boolean;
  numberLabel: string;
  /** Document carries an expiry date the uploader must provide. */
  expiry?: boolean;
};

/* ----------------------------- Catalogues ----------------------------- */

export const RESTAURANT_DOCS: KycDocDef[] = [
  { type: "fssai", label: "FSSAI licence", hint: "Food safety licence certificate", mandatory: true, numberLabel: "FSSAI number", expiry: true },
  { type: "pan", label: "PAN card", hint: "Business or proprietor PAN", mandatory: true, numberLabel: "PAN number" },
  { type: "bank_account", label: "Bank account", hint: "Account number with IFSC", mandatory: true, numberLabel: "Account number" },
  { type: "cancelled_cheque", label: "Cancelled cheque", hint: "Proof of bank account", mandatory: true, numberLabel: "Cheque / reference no." },
  { type: "aadhaar", label: "Aadhaar", hint: "Owner identity proof", mandatory: true, numberLabel: "Aadhaar number" },
  { type: "gst", label: "GST certificate", hint: "Optional — only if GST registered", mandatory: false, numberLabel: "GSTIN" },
];

export const RIDER_DOCS: KycDocDef[] = [
  { type: "aadhaar_front", label: "Aadhaar Front", hint: "Identity proof front side", mandatory: true, numberLabel: "Aadhaar number" },
  { type: "aadhaar_back", label: "Aadhaar Back", hint: "Identity proof back side", mandatory: true, numberLabel: "Aadhaar number" },
  { type: "driving_licence_front", label: "DL Front", hint: "Driving licence front side", mandatory: true, numberLabel: "Licence number", expiry: true },
  { type: "driving_licence_back", label: "DL Back", hint: "Driving licence back side", mandatory: true, numberLabel: "Licence number" },
  { type: "vehicle_rc", label: "Vehicle RC", hint: "Registration certificate", mandatory: true, numberLabel: "Vehicle number" },
  { type: "selfie", label: "Selfie", hint: "Clear profile photo", mandatory: true, numberLabel: "Reference (optional)" },
];

export const MANAGER_DOCS: KycDocDef[] = [
  { type: "aadhaar", label: "Aadhaar", hint: "Identity proof", mandatory: true, numberLabel: "Aadhaar number" },
  { type: "pan", label: "PAN card", hint: "Required for payroll", mandatory: true, numberLabel: "PAN number" },
  { type: "employee_id", label: "Employee ID card", hint: "Scoobix issued ID", mandatory: true, numberLabel: "Employee ID" },
  { type: "bank_account", label: "Bank account", hint: "Salary account details", mandatory: true, numberLabel: "Account number" },
  { type: "photo", label: "Profile photo", hint: "Used on partner-facing screens", mandatory: true, numberLabel: "Reference (optional)" },
  { type: "offer_letter", label: "Offer letter", hint: "Optional — HR record", mandatory: false, numberLabel: "Reference number" },
];

export const DOC_CATALOG: Record<VerifySubject, KycDocDef[]> = {
  restaurant: RESTAURANT_DOCS,
  rider: RIDER_DOCS,
  manager: MANAGER_DOCS,
};

export const SUBJECT_LABEL: Record<VerifySubject, string> = {
  restaurant: "Restaurant",
  rider: "Rider",
  manager: "Merchant manager",
};

export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  verified: "Approved",
  rejected: "Rejected",
  reupload: "Resubmission required",
};

export const KYC_STATUS_TONE: Record<KycStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  under_review: "bg-indigo-100 text-indigo-700",
  verified: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  reupload: "bg-sky-100 text-sky-700",
};

export const REVIEW_ACTIONS: KycStatus[] = ["under_review", "verified", "reupload", "rejected"];

export function normalizeStatus(s?: string | null): KycStatus {
  const v = (s ?? "pending").toLowerCase();
  if (v === "verified" || v === "approved") return "verified";
  if (v === "rejected") return "rejected";
  if (v === "reupload" || v === "resubmit") return "reupload";
  if (v === "under_review" || v === "in_review") return "under_review";
  return "pending";
}

/** Expired documents never count as verified. */
export function isExpired(row?: KycRow | null): boolean {
  if (!row?.expires_at) return false;
  const t = Date.parse(row.expires_at);
  return Number.isFinite(t) && t < Date.now();
}

export function effectiveStatus(row?: KycRow | null): KycStatus {
  const s = normalizeStatus(row?.status);
  if (s === "verified" && isExpired(row)) return "reupload";
  return s;
}

export type Actor = { id?: string | null; name?: string | null; role?: string | null };

/* -------------------------------- Reads -------------------------------- */

function subjectParams(subject: VerifySubject, subjectId: string) {
  // Restaurant rows predate subject_type, so they are matched on restaurant_id.
  return subject === "restaurant"
    ? { restaurant_id: `eq.${subjectId}` }
    : { subject_type: `eq.${subject}`, subject_id: `eq.${subjectId}` };
}

export async function fetchDocs(subject: VerifySubject, subjectId: string): Promise<KycRow[]> {
  if (!subjectId) return [];
  return listTable<KycRow>(VERIFICATION_TABLE, {
    ...subjectParams(subject, subjectId),
    order: "created_at.desc", // Latest first
    limit: 200,
  }, { fresh: true }); // Always fresh for KYC
}

export async function fetchLogs(subject: VerifySubject, subjectId: string): Promise<KycAuditRow[]> {
  if (!subjectId) return [];
  return listTable<KycAuditRow>(VERIFICATION_LOG_TABLE, {
    ...subjectParams(subject, subjectId),
    order: "created_at.desc",
    limit: 200,
  });
}

/** Merge stored rows with the catalogue so every document always has an entry. */
export function mergeDocs(subject: VerifySubject, rows: KycRow[]): { def: KycDocDef; row: KycRow | null }[] {
  return DOC_CATALOG[subject].map((def) => ({
    def,
    row: rows.find((r) => (r.doc_type ?? "").toLowerCase() === def.type) ?? null,
  }));
}

/* ------------------------------- Summary ------------------------------- */

export type KycSummary = {
  verified: number;
  mandatoryTotal: number;
  mandatoryVerified: number;
  percent: number;
  complete: boolean;
  pending: number;
  underReview: number;
  blocked: number;
  expiringSoon: number;
};

export function summarize(subject: VerifySubject, rows: KycRow[]): KycSummary {
  const merged = mergeDocs(subject, rows);
  const mandatory = merged.filter((m) => m.def.mandatory);
  const st = (r: KycRow | null) => effectiveStatus(r);
  const mandatoryVerified = mandatory.filter((m) => st(m.row) === "verified").length;
  const soon = 30 * 24 * 3600 * 1000;
  return {
    verified: merged.filter((m) => st(m.row) === "verified").length,
    mandatoryTotal: mandatory.length,
    mandatoryVerified,
    percent: mandatory.length ? Math.round((mandatoryVerified / mandatory.length) * 100) : 0,
    complete: mandatory.length > 0 && mandatoryVerified === mandatory.length,
    pending: merged.filter((m) => m.row && st(m.row) === "pending").length,
    underReview: merged.filter((m) => m.row && st(m.row) === "under_review").length,
    blocked: merged.filter((m) => m.row && (st(m.row) === "rejected" || st(m.row) === "reupload")).length,
    expiringSoon: merged.filter((m) => {
      const t = m.row?.expires_at ? Date.parse(m.row.expires_at) : NaN;
      return Number.isFinite(t) && t > Date.now() && t - Date.now() < soon;
    }).length,
  };
}

/* ---------------------------- Notifications ---------------------------- */

async function ownerUserId(subject: VerifySubject, subjectId: string): Promise<string | null> {
  try {
    if (subject === "restaurant") {
      const [r] = await listTable<{ owner_id?: string | null }>("restaurants", { id: `eq.${subjectId}`, limit: 1 });
      return r?.owner_id ?? null;
    }
    const table = subject === "rider" ? "drivers" : "merchant_managers";
    const [r] = await listTable<{ user_id?: string | null }>(table, { id: `eq.${subjectId}`, limit: 1 });
    return r?.user_id ?? null;
  } catch {
    return null;
  }
}

async function notifySubject(subject: VerifySubject, subjectId: string, title: string, message: string) {
  const userId = await ownerUserId(subject, subjectId);
  if (!userId) return;
  await createRecord("notifications", { user_id: userId, title, message, read_status: false }).catch(() => null);
}

async function log(entry: Partial<KycAuditRow>) {
  await createRecord(VERIFICATION_LOG_TABLE, { ...entry, created_at: new Date().toISOString() });
}

/* -------------------------------- Writes ------------------------------- */

/** Uploader submission — always resets the document to `pending`. */
export async function submitDoc(
  subject: VerifySubject,
  subjectId: string,
  def: KycDocDef,
  data: { doc_number?: string | null; file_url?: string | null; file_name?: string | null; expires_at?: string | null },
  existing: KycRow | null,
  actor: Actor = {},
): Promise<void> {
  if (!subjectId) return;
  const now = new Date().toISOString();
  const payload = {
    restaurant_id: subject === "restaurant" ? subjectId : null,
    subject_type: subject,
    subject_id: subjectId,
    doc_type: def.type,
    doc_number: data.doc_number ?? existing?.doc_number ?? null,
    file_url: data.file_url ?? existing?.file_url ?? null,
    file_name: data.file_name ?? existing?.file_name ?? null,
    expires_at: data.expires_at ?? existing?.expires_at ?? null,
    status: "pending",
    mandatory: def.mandatory,
    remarks: null,
    uploaded_by: actor.id ?? existing?.uploaded_by ?? null,
    submitted_at: now,
    reviewed_at: null,
    reviewed_by: null,
    updated_at: now,
  };

  let kycId = existing?.id ?? null;
  if (existing?.id) {
    await patchRecord(VERIFICATION_TABLE, existing.id, payload);
  } else {
    const created = await createRecord<KycRow | KycRow[]>(VERIFICATION_TABLE, { ...payload, created_at: now });
    const row = Array.isArray(created) ? created[0] : created;
    kycId = row?.id ?? null;
    if (!kycId) {
      // Fallback: fetch the record we just created to get the ID
      const latest = await listTable<KycRow>(VERIFICATION_TABLE, {
        ...subjectParams(subject, subjectId),
        doc_type: `eq.${def.type}`,
        order: "created_at.desc",
        limit: 1
      }, { fresh: true });
      kycId = latest[0]?.id ?? null;
    }
  }

  await log({
    restaurant_id: subject === "restaurant" ? subjectId : null,
    subject_type: subject,
    subject_id: subjectId,
    kyc_id: kycId,
    doc_type: def.type,
    action: existing ? "resubmitted" : "submitted",
    from_status: existing ? normalizeStatus(existing.status) : null,
    to_status: "pending",
    actor_id: actor.id ?? null,
    actor_name: actor.name ?? null,
    actor_role: actor.role ?? subject,
  });
}

/** Reviewer decision on a document. */
export async function reviewDoc(
  subject: VerifySubject,
  subjectId: string,
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
    await patchRecord(VERIFICATION_TABLE, existing.id, patch);
    row = { ...existing, ...patch };
  } else {
    const created = await createRecord<KycRow | KycRow[]>(VERIFICATION_TABLE, {
      restaurant_id: subject === "restaurant" ? subjectId : null,
      subject_type: subject,
      subject_id: subjectId,
      doc_type: def.type,
      mandatory: def.mandatory,
      created_at: now,
      ...patch,
    });
    row = (Array.isArray(created) ? created[0] : created) ?? null;
    if (!row?.id) {
       const latest = await listTable<KycRow>(VERIFICATION_TABLE, {
        ...subjectParams(subject, subjectId),
        doc_type: `eq.${def.type}`,
        order: "created_at.desc",
        limit: 1
      }, { fresh: true });
      row = latest[0] ?? null;
    }
  }

  await log({
    restaurant_id: subject === "restaurant" ? subjectId : null,
    subject_type: subject,
    subject_id: subjectId,
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

  await notifySubject(
    subject,
    subjectId,
    `${def.label} — ${KYC_STATUS_LABEL[status]}`,
    remarks || `Your ${def.label.toLowerCase()} is now ${KYC_STATUS_LABEL[status].toLowerCase()}.`,
  );

  // Keep the subject's roll-up flag in sync so gating never needs a re-scan.
  await syncSubjectStatus(subject, subjectId);
  return row;
}

/** Recompute and persist the subject-level verification flag. */
export async function syncSubjectStatus(subject: VerifySubject, subjectId: string): Promise<KycSummary> {
  const summary = summarize(subject, await fetchDocs(subject, subjectId));
  const state: KycStatus = summary.complete
    ? "verified"
    : summary.blocked
      ? "reupload"
      : summary.underReview
        ? "under_review"
        : "pending";
  const table = subject === "restaurant" ? "restaurants" : subject === "rider" ? "drivers" : "merchant_managers";
  const patch: Record<string, unknown> = { docs_verified: summary.complete };
  if (subject !== "restaurant") patch.verification_status = state;
  await patchRecord(table, subjectId, patch).catch(() => null);
  return summary;
}

export async function isVerificationComplete(subject: VerifySubject, subjectId: string): Promise<boolean> {
  if (!subjectId) return false;
  return summarize(subject, await fetchDocs(subject, subjectId)).complete;
}
