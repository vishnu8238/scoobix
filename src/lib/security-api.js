import { listTable, patchRecord, createRecord, patchWhereIn } from "./insforge-crud";
import { deviceContext } from "./device-context";
export const SESSIONS_TABLE = "user_sessions";
export const LOGIN_TABLE = "login_history";
export const EVENTS_TABLE = "security_events";
export const DEVICES_TABLE = "device_registry";
export const USERS_TABLE = "users";
/* ------------------------------------------------------------- overview */
export async function securityOverview() {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [events, sessions, devices, lockedUsers, failedLogins, deletions] = await Promise.all([
        listTable(EVENTS_TABLE, { acknowledged: "eq.false", limit: 50 }, { select: "id,type,severity,title,detail,created_at" }).catch(() => []),
        listTable(SESSIONS_TABLE, { status: "eq.active", limit: 100 }, { select: "id,user_id,created_at" }).catch(() => []),
        listTable(DEVICES_TABLE, { limit: 100 }, { select: "id,trusted,blocked" }).catch(() => []),
        listTable(USERS_TABLE, { "or": "(account_state.eq.locked,account_state.eq.suspended)", limit: 50 }, { select: "id,name,account_state" }).catch(() => []),
        listTable(LOGIN_TABLE, { success: "eq.false", created_at: `gte.${dayAgo}`, limit: 100 }, { select: "id,email,created_at" }).catch(() => []),
        listTable(USERS_TABLE, { account_state: "eq.pending_deletion", limit: 50 }, { select: "id,name,account_state" }).catch(() => []),
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
export async function lockAccount(userId, actor, reason) {
    await patchRecord(USERS_TABLE, userId, {
        account_state: 'locked',
        locked: true,
        lock_reason: reason,
        locked_at: new Date().toISOString(),
        locked_by: actor.id
    });
}
export async function suspendAccount(id, actor, reason, days) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    await patchRecord(USERS_TABLE, id, {
        account_state: 'suspended',
        suspended_until: until,
        suspension_reason: reason
    });
}
export async function unlockAccount(userId, actor) {
    await patchRecord(USERS_TABLE, userId, {
        account_state: 'active',
        locked: false,
        lock_reason: null,
        locked_at: null,
        locked_by: null
    });
}
export async function restoreAccount(id, actor) {
    await patchRecord(USERS_TABLE, id, {
        account_state: 'active',
        suspended_until: null,
        suspension_reason: null,
        locked: false,
        lock_reason: null
    });
}
/* -------------------------------------------------------- security events */
export async function recordSecurityEvent(input) {
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
export async function acknowledgeSecurityEvents(ids, adminId) {
    const now = new Date().toISOString();
    await patchWhereIn(EVENTS_TABLE, ids, {
        acknowledged: true,
        acknowledged_by: adminId,
        acknowledged_at: now
    });
}
/* ------------------------------------------------------------- sessions */
export async function revokeSession(sessionId, actor, reason = "admin_revoked") {
    await patchRecord(SESSIONS_TABLE, sessionId, {
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: actor.id,
        revoke_reason: reason
    });
}
export async function revokeAllSessions(userId, actor, opts = {}) {
    const sessions = await listTable(SESSIONS_TABLE, { user_id: `eq.${userId}`, status: "eq.active" });
    if (!sessions.length)
        return 0;
    await patchWhereIn(SESSIONS_TABLE, sessions.map(s => s.id), {
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: actor.id,
        revoke_reason: opts.reason || "admin_revoked_all"
    });
    return sessions.length;
}
/* ------------------------------------------------------------- devices */
export async function setDeviceFlags(id, flags) {
    await patchRecord(DEVICES_TABLE, id, {
        ...flags,
        updated_at: new Date().toISOString()
    });
}
