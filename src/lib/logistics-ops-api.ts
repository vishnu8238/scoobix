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
  // audit_logs is verified, but custom columns like 'entity' aren't. 
  // We keep it restricted to confirmed columns.
  return listTable<Dispute>("audit_logs", { 
    select: "id,actor_id,action,created_at", 
    order: "created_at.desc", 
    ...params 
  });
}

export async function updateDisputeStatus(id: string, status: Dispute["status"], resolution?: string, actor?: string) {
  // Update action to reflect status change in audit_logs
  return patchRecord("audit_logs", id, { 
    action: `DISPUTE_${status.toUpperCase()}`,
    actor_id: actor
  });
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
  return listTable<GroomingSelfie>("grooming_selfies", { select: "*", order: "created_at.desc", ...params });
}
