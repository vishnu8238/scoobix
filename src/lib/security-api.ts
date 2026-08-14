import { listTable, patchRecord, createRecord, patchWhereIn } from "./insforge-crud";
import { deviceContext } from "./device-context";

/* ------------------------------------------------------------------ types */

export type SessionRow = {
  id: string;
  user_id?: string; role?: string; device_id?: string; device_label?: string;
  browser?: string; os?: string; platform?: string; app?: string;
  ip?: string; user_agent?: string; status?: string; current?: boolean;
  last_seen_at?: string; expires_at?: string; revoked_at?: string;
  revoked_by?: string; revoke_reason?: string; created_at?: string;
};

export type LoginRow = {
  id: string;
  user_id?: string; email?: string; role?: string; event?: string; provider?: string;
  success?: boolean; reason?: string; ip?: string; city?: string; country?: string;
  device_id?: string; device_label?: string; browser?: string; os?: string;
  platform?: string; user_agent?: string; created_at?: string;
};

export type SecurityEventRow = {
  id: string;
  user_id?: string; role?: string; type?: string; severity?: string;
  title?: string; detail?: string; actor_id?: string; actor_role?: string;
  ip?: string; device_id?: string; meta?: Record<string, unknown> | null;
  acknowledged?: boolean; acknowledged_by?: string; acknowledged_at?: string;
  created_at?: string;
};

export type DeviceRow = {
  id: string;
  device_id?: string; user_id?: string; label?: string; browser?: string; os?: string;
  platform?: string; app?: string; trusted?: boolean; blocked?: boolean;
  account_count?: number; login_count?: number; last_ip?: string;
  last_lat?: number; last_lng?: number; first_seen_at?: string; last_seen_at?: string;
  meta?: Record<string, unknown> | null; created_at?: string;
};

export type UserSecurityRow = {
  id: string;
  email?: string; role?: string; name?: string; phone?: string;
  account_state?: string; locked?: boolean; lock_reason?: string; locked_at?: string; locked_by?: string;
  suspended_until?: string; suspension_reason?: string;
  failed_login_count?: number; last_failed_login_at?: string;
  password_changed_at?: string; deletion_requested_at?: string;
  deletion_scheduled_for?: string; deleted_at?: string;
  marketing_opt_in?: boolean; privacy_version?: string; terms_version?: string;
  is_super_admin?: boolean; permissions?: unknown; created_at?: string;
};

export const SESSIONS_TABLE = "user_sessions";
export const LOGIN_TABLE = "login_history";
export const EVENTS_TABLE = "security_events";
export const DEVICES_TABLE = "device_registry";
export const USERS_TABLE = "users";

/* ------------------------------------------------------------- overview */

export async function securityOverview() {
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  
  const [events, sessions, devices, lockedUsers, failedLogins, deletions] = await Promise.all([
    listTable<SecurityEventRow>(EVENTS_TABLE, { acknowledged: "eq.false", limit: 50 }, { select: "id,type,severity,title,detail,created_at" }).catch(() => []),
    listTable<SessionRow>(SESSIONS_TABLE, { status: "eq.active", limit: 100 }, { select: "id,user_id,created_at" }).catch(() => []),
    listTable<DeviceRow>(DEVICES_TABLE, { limit: 100 }, { select: "id,trusted,blocked" }).catch(() => []),
    listTable<UserSecurityRow>(USERS_TABLE, { "or": "(account_state.eq.locked,account_state.eq.suspended)", limit: 50 }, { select: "id,name,account_state" }).catch(() => []),
    listTable<LoginRow>(LOGIN_TABLE, { success: "eq.false", created_at: `gte.${dayAgo}`, limit: 100 }, { select: "id,email,created_at" }).catch(() => []),
    listTable<UserSecurityRow>(USERS_TABLE, { account_state: "eq.pending_deletion", limit: 50 }, { select: "id,name,account_state" }).catch(() => []),
  ]);

  return {
    openAlerts: events.length,
    criticalAlerts: events.filter((e) => e.severity === 'critical').length,
    failedLogins24h: failedLogins.length,
    activeSessions: sessions.length,
    lockedAccounts: lockedUsers.length,
    deviceCount: devices.length,
    blockedDevices: devices.filter((d) => d.blocked).length,
    pendingDeletions: deletions.length,
    events,
    sessionList: sessions,
    deviceList: devices,
    lockedUsers,
    failedList: failedLogins,
    deletionRequests: deletions,
    deletions // Legacy field for UI compatibility
  };
}

/* -------------------------------------------------------- account actions */

export async function lockAccount(userId: string, actor: any, reason: string) {
  await patchRecord(USERS_TABLE, userId, {
    account_state: 'locked',
    locked: true,
    lock_reason: reason,
    locked_at: new Date().toISOString(),
    locked_by: actor.id
  });
}

export async function suspendAccount(id: string, actor: any, reason: string, days: number) {
  const until = new Date(Date.now() + days * 86400_000).toISOString();
  await patchRecord(USERS_TABLE, id, {
    account_state: 'suspended',
    suspended_until: until,
    suspension_reason: reason
  });
}

export async function unlockAccount(userId: string, actor: any) {
  await patchRecord(USERS_TABLE, userId, {
    account_state: 'active',
    locked: false,
    lock_reason: null,
    locked_at: null,
    locked_by: null
  });
}

export async function restoreAccount(id: string, actor: any) {
  await patchRecord(USERS_TABLE, id, {
    account_state: 'active',
    suspended_until: null,
    suspension_reason: null,
    locked: false,
    lock_reason: null
  });
}

/* -------------------------------------------------------- security events */

export async function recordSecurityEvent(input: {
  userId?: string | null;
  type: string;
  severity: string;
  title: string;
  detail?: string;
  meta?: any;
}) {
  const ctx = deviceContext();
  return createRecord<SecurityEventRow>(EVENTS_TABLE, {
    user_id: input.userId,
    type: input.type,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    meta: input.meta,
    ip: ctx.ip,
    device_id: ctx.deviceId,
    acknowledged: false,
    created_at: new Date().toISOString()
  });
}

export async function acknowledgeSecurityEvents(ids: string[], adminId: string) {
  const now = new Date().toISOString();
  await patchWhereIn(EVENTS_TABLE, ids, {
    acknowledged: true,
    acknowledged_by: adminId,
    acknowledged_at: now
  });
}

/* ------------------------------------------------------------- sessions */

export async function revokeSession(sessionId: string, actor: any, reason = "admin_revoked") {
  await patchRecord(SESSIONS_TABLE, sessionId, {
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    revoked_by: actor.id,
    revoke_reason: reason
  });
}

export async function revokeAllSessions(userId: string, actor: any, opts: any = {}) {
  const sessions = await listTable<SessionRow>(SESSIONS_TABLE, { user_id: `eq.${userId}`, status: "eq.active" });
  if (!sessions.length) return 0;
  
  await patchWhereIn(SESSIONS_TABLE, sessions.map(s => s.id), {
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    revoked_by: actor.id,
    revoke_reason: opts.reason || "admin_revoked_all"
  });
  return sessions.length;
}

/* ------------------------------------------------------------- devices */

export async function setDeviceFlags(id: string, flags: { trusted?: boolean; blocked?: boolean }) {
  await patchRecord(DEVICES_TABLE, id, {
    ...flags,
    updated_at: new Date().toISOString()
  });
}
