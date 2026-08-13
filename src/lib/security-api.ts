import { listTable, patchRecord, createRecord, createRecords } from "./insforge-crud";
import { logAudit } from "./audit-api";
import { deviceContext } from "./device-context";

export const USERS_TABLE = "users";
export const EVENTS_TABLE = "security_events";
export const SESSIONS_TABLE = "user_sessions";
export const DEVICES_TABLE = "device_registry";

export async function securityOverview() {
  const [events, sessions, devices, users] = await Promise.all([
    listTable(EVENTS_TABLE, { acknowledged: "eq.false", limit: 50 }).catch(() => []),
    listTable(SESSIONS_TABLE, { status: "eq.active", limit: 100 }).catch(() => []),
    listTable(DEVICES_TABLE, { limit: 100 }).catch(() => []),
    listTable(USERS_TABLE, { "or": "(account_state.eq.locked,account_state.eq.suspended)", limit: 50 }).catch(() => [])
  ]);

  return {
    openAlerts: events.length,
    criticalAlerts: events.filter((e: any) => e.severity === 'critical').length,
    failedLogins24h: 0, // Needs login_history join/count
    activeSessions: sessions.length,
    lockedAccounts: users.length,
    deviceCount: devices.length,
    blockedDevices: devices.filter((d: any) => d.blocked).length,
    pendingDeletions: 0,
    events,
    sessionList: sessions,
    deviceList: devices,
    lockedUsers: users,
    deletionRequests: []
  };
}

export async function recordSecurityEvent(input: {
  userId?: string | null;
  type: string;
  severity: string;
  title: string;
  detail?: string;
  meta?: any;
}) {
  const ctx = deviceContext();
  return createRecord(EVENTS_TABLE, {
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
  await Promise.all(ids.map(id => 
    patchRecord(EVENTS_TABLE, id, {
      acknowledged: true,
      acknowledged_by: adminId,
      acknowledged_at: now
    })
  ));
}

export async function lockAccount(userId: string, actor: any, reason: string) {
  await patchRecord(USERS_TABLE, userId, {
    account_state: 'locked',
    locked: true,
    lock_reason: reason,
    locked_at: new Date().toISOString(),
    locked_by: actor.id
  });
  await recordSecurityEvent({
    userId,
    type: 'account_locked',
    severity: 'high',
    title: 'Account Locked',
    detail: reason,
    meta: { locked_by: actor.id }
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
  await recordSecurityEvent({
    userId,
    type: 'account_unlocked',
    severity: 'notice',
    title: 'Account Unlocked',
    meta: { unlocked_by: actor.id }
  });
}
