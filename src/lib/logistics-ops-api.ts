import { listTable, createRecord, patchRecord } from "./insforge-crud";

export type Dispute = {
  id: string;
  entity_type: "order" | "payout" | "gig";
  entity_id: string;
  subject: string;
  description: string;
  status: "pending" | "investigating" | "resolved" | "rejected";
  priority: "low" | "medium" | "high";
  evidence_urls?: string[];
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
};

export async function fetchDisputes(params?: Record<string, any>) {
  return listTable<Dispute>("audit_logs", { entity: "eq.dispute", order: "created_at.desc", ...params });
}

export async function updateDisputeStatus(id: string, status: Dispute["status"], resolution?: string, actor?: string) {
  const patch: any = { status };
  if (status === "resolved" || status === "rejected") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = actor;
    if (resolution) patch.resolution_notes = resolution;
  }
  return patchRecord("audit_logs", id, patch);
}

export type GroomingSelfie = {
  id: string;
  rider_id: string;
  rider_name?: string;
  image_url: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
};

export async function fetchSelfies(params?: Record<string, any>) {
  return listTable<GroomingSelfie>("grooming_selfies", { order: "created_at.desc", ...params });
}
