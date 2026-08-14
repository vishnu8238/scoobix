import { listTable } from "./insforge-crud";

export type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id?: string;
  previous_value?: any;
  new_value?: any;
  reason?: string;
  timestamp: string;
  admin_name?: string;
};

export async function fetchAuditLogs(params?: Record<string, any>) {
  return listTable<AuditLog>("audit_logs", { select: "*", order: "timestamp.desc", ...params });
}
