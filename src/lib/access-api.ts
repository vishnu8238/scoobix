import { listTable, createRecord, patchRecord, deleteRecord } from "@/lib/insforge-crud";
import { logAudit } from "@/lib/audit-api";
import { PortalAccessRow, PortalType, PortalStatus } from "@/lib/portal-authorization";

export async function listPortalAccess(params?: Record<string, any>) {
  return listTable<PortalAccessRow>("portal_access", { order: "created_at.desc", ...params });
}

export async function createPortalAccess(data: {
  email: string;
  portal: PortalType;
  status: PortalStatus;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}) {
  const record = {
    email: data.email.trim(),
    email_normalized: data.email.trim().toLowerCase(),
    portal: data.portal,
    status: data.status,
    created_by: data.actorId,
  };

  const res = await createRecord<PortalAccessRow>("portal_access", record);
  
  if (res) {
    logAudit({
      action: "ACCESS_CREATED",
      category: "auth",
      actorId: data.actorId,
      actorName: data.actorName,
      actorRole: data.actorRole,
      subjectType: "portal_access",
      subjectId: res.id,
      summary: `Created access for ${data.email} to ${data.portal} (status: ${data.status})`,
      severity: "notice",
      meta: { email: data.email, portal: data.portal, status: data.status }
    });
  }
  return res;
}

export async function updatePortalAccess(
  id: string,
  patch: Partial<PortalAccessRow>,
  data: {
    email: string;
    portal: PortalType;
    previousStatus: PortalStatus;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
  }
) {
  const res = await patchRecord<PortalAccessRow>("portal_access", id, patch);
  
  if (res) {
    let action = "ACCESS_UPDATED";
    if (patch.status === "active" && data.previousStatus === "disabled") action = "ACCESS_ENABLED";
    if (patch.status === "disabled" && data.previousStatus === "active") action = "ACCESS_DISABLED";

    logAudit({
      action,
      category: "auth",
      actorId: data.actorId,
      actorName: data.actorName,
      actorRole: data.actorRole,
      subjectType: "portal_access",
      subjectId: id,
      summary: `${action}: ${data.email} on ${data.portal}`,
      severity: "notice",
      meta: { 
        id, 
        email: data.email, 
        portal: data.portal, 
        previous_status: data.previousStatus,
        new_status: patch.status 
      }
    });
  }
  return res;
}

export async function removePortalAccess(
  id: string,
  data: {
    email: string;
    portal: PortalType;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
  }
) {
  await deleteRecord("portal_access", id);
  
  logAudit({
    action: "ACCESS_REMOVED",
    category: "auth",
    actorId: data.actorId,
    actorName: data.actorName,
    actorRole: data.actorRole,
    subjectType: "portal_access",
    subjectId: id,
    summary: `Removed access for ${data.email} from ${data.portal}`,
    severity: "warning",
    meta: { id, email: data.email, portal: data.portal }
  });
}
