/**
 * Session management, account security, security events, consent and privacy.
 *
 * Everything here is backend-driven: sessions live in `user_sessions`, logins in
 * `login_history`, devices in `device_registry`, alerts in `security_events`,
 * consent in `consent_records`, and account state on `public.users`.
 */
import {
  createRecord, createRecords, deleteRecord, invalidateTable,
  listPage, listTable, patchRecord, patchWhereIn,
} from "./insforge-crud";
import { logAudit, subjectTrail } from "./audit-api";
import { currentApp, deviceContext, resolveIp } from "./device-context";
import { clearElevationCache, clearOverrideCache, type Permission, type SecurityRole } from "./permissions";
import { sanitizeText } from "./api-guard";

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

export type SecurityEventType =
  | "new_login" | "password_changed" | "email_changed" | "phone_changed"
  | "account_locked" | "account_unlocked" | "account_suspended" | "account_restored"
  | "deletion_requested" | "deletion_cancelled" | "permission_changed"
  | "fraud_alert" | "session_revoked" | "data_exported" | "consent_updated" | "rate_limited";

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

export type ConsentKind =
  | "privacy_policy" | "terms" | "marketing_email" | "marketing_push"
  | "marketing_sms" | "data_processing" | "cookies";

export type ConsentRow = {
  id: string; user_id?: string; kind?: string; version?: string; granted?: boolean;
  source?: string; ip?: string; device_id?: string; updated_at?: string; created_at?: string;
};

export type AccountState = "active" | "locked" | "suspended" | "pending_deletion" | "deleted";

export const SESSIONS_TABLE = "user_sessions";
export const LOGIN_TABLE = "login_history";
export const EVENTS_TABLE = "security_events";
export const DEVICES_TABLE = "device_registry";
export const CONSENT_TABLE = "consent_records";
export const OVERRIDES_TABLE = "permission_overrides";
export const USERS_TABLE = "users";

const SESSION_TTL_DAYS = 30;
const LOCAL_SESSION_KEY = "scoobix.security.session_row";

/* -------------------------------------------------------- security events */

/** Record a security event (also mirrored into the audit trail). */
export async function recordSecurityEvent(input: {
  userId?: string | null;
  role?: string | null;
  type: SecurityEventType;
  title: string;
  detail?: string;
  severity?: "info" | "warning" | "critical";
  actorId?: string | null;
  actorRole?: string | null;
  meta?: Record<string, unknown>;
}): Promise<SecurityEventRow | null> {
  const ctx = deviceContext();
  const row = await createRecord<SecurityEventRow>(EVENTS_TABLE, {
    user_id: input.userId ?? null,
    role: input.role ?? null,
    type: input.type,
    severity: input.severity ?? "info",
    title: sanitizeText(input.title, 200),
    detail: input.detail ? sanitizeText(input.detail, 600) : null,
    actor_id: input.actorId ?? input.userId ?? null,
    actor_role: input.actorRole ?? input.role ?? null,
    ip: ctx.ip,
    device_id: ctx.deviceId,
    meta: input.meta ?? null,
    acknowledged: false,
    created_at: new Date().toISOString(),
  }).catch(() => null);

  logAudit({
    action: `security.${input.type}`,
    category: "security",
    actorId: input.actorId ?? input.userId ?? null,
    actorRole: input.actorRole ?? input.role ?? null,
    subjectType: "user",
    subjectId: input.userId ?? undefined,
    summary: input.title,
    severity: input.severity === "critical" ? "critical" : input.severity === "warning" ? "warning" : "info",
    meta: input.meta,
  });
  return row;
}

const EVENT_SELECT =
  "id,user_id,role,type,severity,title,detail,actor_id,actor_role,ip,device_id,meta,acknowledged,acknowledged_by,acknowledged_at,created_at";

export function listSecurityEvents(opts: {
  userId?: string; type?: SecurityEventType; severity?: string; onlyOpen?: boolean; limit?: number;
} = {}) {
  const params: Record<string, string | number> = { select: EVENT_SELECT, order: "created_at.desc", limit: opts.limit ?? 100 };
  if (opts.userId) params.user_id = `eq.${opts.userId}`;
  if (opts.type) params.type = `eq.${opts.type}`;
  if (opts.severity && opts.severity !== "all") params.severity = `eq.${opts.severity}`;
  if (opts.onlyOpen) params.acknowledged = "eq.false";
  return listTable<SecurityEventRow>(EVENTS_TABLE, params, { ttl: 20 });
}

export async function acknowledgeSecurityEvents(ids: string[], adminId: string) {
  if (!ids.length) return;
  await patchWhereIn(EVENTS_TABLE, ids, {
    acknowledged: true, acknowledged_by: adminId, acknowledged_at: new Date().toISOString(),
  });
  invalidateTable(EVENTS_TABLE);
}

/* --------------------------------------------------------- device registry */

/** Upsert the current device for a user and refresh its counters. */
export async function touchDevice(userId: string, opts: { lat?: number; lng?: number } = {}): Promise<DeviceRow | null> {
  const ctx = deviceContext();
  const now = new Date().toISOString();
  const existing = await listTable<DeviceRow>(DEVICES_TABLE, {
    select: "id,device_id,user_id,login_count,blocked,trusted,last_lat,last_lng,first_seen_at",
    device_id: `eq.${ctx.deviceId}`, user_id: `eq.${userId}`, limit: 1,
  }, { fresh: true }).catch(() => []);

  const patch = {
    label: ctx.label,
    browser: ctx.browser,
    os: ctx.os,
    platform: ctx.platform,
    app: currentApp(),
    last_ip: ctx.ip,
    last_seen_at: now,
    ...(opts.lat !== undefined ? { last_lat: opts.lat, last_lng: opts.lng } : {}),
  };

  if (existing[0]) {
    const prev = existing[0];
    const row = await patchRecord<DeviceRow>(DEVICES_TABLE, prev.id, {
      ...patch, login_count: (prev.login_count ?? 0) + 1,
    }).catch(() => null);
    return row ?? prev;
  }
  return createRecord<DeviceRow>(DEVICES_TABLE, {
    ...patch,
    device_id: ctx.deviceId,
    user_id: userId,
    trusted: false,
    blocked: false,
    account_count: 1,
    login_count: 1,
    first_seen_at: now,
    created_at: now,
  }).catch(() => null);
}

export function listDevices(userId?: string, limit = 100) {
  const params: Record<string, string | number> = {
    select: "id,device_id,user_id,label,browser,os,platform,app,trusted,blocked,account_count,login_count,last_ip,last_seen_at,first_seen_at",
    order: "last_seen_at.desc", limit,
  };
  if (userId) params.user_id = `eq.${userId}`;
  return listTable<DeviceRow>(DEVICES_TABLE, params, { ttl: 60 });
}

export async function setDeviceFlags(id: string, flags: { trusted?: boolean; blocked?: boolean }) {
  await patchRecord(DEVICES_TABLE, id, flags);
  invalidateTable(DEVICES_TABLE);
}

/* ------------------------------------------------------------- sessions */

const SESSION_SELECT =
  "id,user_id,role,device_id,device_label,browser,os,platform,app,ip,user_agent,status,current,last_seen_at,expires_at,revoked_at,revoked_by,revoke_reason,created_at";

function rememberLocalSession(id: string | null) {
  try {
    if (!id) sessionStorage.removeItem(LOCAL_SESSION_KEY);
    else sessionStorage.setItem(LOCAL_SESSION_KEY, id);
  } catch { /* ignore */ }
}

export function localSessionId(): string | null {
  try { return sessionStorage.getItem(LOCAL_SESSION_KEY); } catch { return null; }
}

/**
 * Open (or refresh) the session row for this device. Called right after a
 * successful login and on session restore.
 */
export async function startSession(userId: string, role: string): Promise<SessionRow | null> {
  await resolveIp().catch(() => null);
  const ctx = deviceContext();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();

  // One active row per (user, device, app) — reuse it instead of piling up rows.
  const existing = await listTable<SessionRow>(SESSIONS_TABLE, {
    select: "id,status", user_id: `eq.${userId}`, device_id: `eq.${ctx.deviceId}`,
    app: `eq.${currentApp()}`, status: "eq.active", limit: 1,
  }, { fresh: true }).catch(() => []);

  const payload = {
    user_id: userId,
    role,
    device_id: ctx.deviceId,
    device_label: ctx.label,
    browser: ctx.browser,
    os: ctx.os,
    platform: ctx.platform,
    app: currentApp(),
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    status: "active",
    current: true,
    last_seen_at: now,
    expires_at: expires,
  };

  const row = existing[0]
    ? await patchRecord<SessionRow>(SESSIONS_TABLE, existing[0].id, payload).catch(() => null)
    : await createRecord<SessionRow>(SESSIONS_TABLE, { ...payload, created_at: now }).catch(() => null);

  const id = (row as SessionRow | null)?.id ?? existing[0]?.id ?? null;
  if (id) rememberLocalSession(id);
  void touchDevice(userId);
  return (row as SessionRow | null) ?? null;
}

/** Cheap heartbeat so "active sessions" reflects reality. */
export async function heartbeatSession(): Promise<void> {
  const id = localSessionId();
  if (!id) return;
  await patchRecord(SESSIONS_TABLE, id, { last_seen_at: new Date().toISOString() }).catch(() => null);
}

export function listSessions(userId: string, opts: { includeRevoked?: boolean } = {}) {
  const params: Record<string, string | number> = {
    select: SESSION_SELECT, user_id: `eq.${userId}`, order: "last_seen_at.desc", limit: 100,
  };
  if (!opts.includeRevoked) params.status = "eq.active";
  return listTable<SessionRow>(SESSIONS_TABLE, params, { ttl: 20 });
}

export function listAllActiveSessions(limit = 200) {
  return listPage<SessionRow>(SESSIONS_TABLE, 0, limit, {
    select: SESSION_SELECT, status: "eq.active", order: "last_seen_at.desc",
  }, { ttl: 30 });
}

/** Revoke a single session (admin or the owner). */
export async function revokeSession(sessionId: string, actor: { id: string; role?: string }, reason = "manual") {
  await patchRecord(SESSIONS_TABLE, sessionId, {
    status: "revoked", current: false, revoked_at: new Date().toISOString(),
    revoked_by: actor.id, revoke_reason: sanitizeText(reason, 200),
  });
  invalidateTable(SESSIONS_TABLE);
  logAudit({
    action: "session.revoke", category: "security", actorId: actor.id, actorRole: actor.role,
    subjectType: "session", subjectId: sessionId, summary: `Session revoked (${reason})`, severity: "notice",
  });
}

/** Log out everywhere: revokes every active session for the user. */
export async function revokeAllSessions(
  userId: string,
  actor: { id: string; role?: string },
  opts: { exceptSessionId?: string; reason?: string } = {},
): Promise<number> {
  const rows = await listTable<SessionRow>(SESSIONS_TABLE, {
    select: "id", user_id: `eq.${userId}`, status: "eq.active", limit: 200,
  }, { fresh: true }).catch(() => []);
  const ids = rows.map((r) => r.id).filter((id) => id !== opts.exceptSessionId);
  if (!ids.length) return 0;
  await patchWhereIn(SESSIONS_TABLE, ids, {
    status: "revoked", current: false, revoked_at: new Date().toISOString(),
    revoked_by: actor.id, revoke_reason: sanitizeText(opts.reason ?? "logout_all", 200),
  });
  invalidateTable(SESSIONS_TABLE);
  await recordSecurityEvent({
    userId, type: "session_revoked", severity: "warning",
    title: `${ids.length} session${ids.length === 1 ? "" : "s"} signed out`,
    detail: opts.reason ?? "Signed out from all devices",
    actorId: actor.id, actorRole: actor.role,
  });
  return ids.length;
}

/** Mark this device's session closed on sign-out. */
export async function endCurrentSession(userId?: string | null) {
  const id = localSessionId();
  rememberLocalSession(null);
  if (!id) return;
  await patchRecord(SESSIONS_TABLE, id, {
    status: "expired", current: false, revoked_at: new Date().toISOString(), revoke_reason: "signed_out",
  }).catch(() => null);
  if (userId) {
    logAudit({ action: "auth.logout", category: "auth", actorId: userId, subjectType: "user", subjectId: userId, summary: "Signed out" });
  }
}

/* -------------------------------------------------------- login history */

const LOGIN_SELECT =
  "id,user_id,email,role,event,provider,success,reason,ip,city,country,device_id,device_label,browser,os,platform,created_at";

/** Record a login attempt (success or failure) plus its device context. */
export async function recordLogin(input: {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
  event: "login" | "logout" | "failed" | "locked" | "password_reset" | "oauth";
  provider?: string;
  success: boolean;
  reason?: string;
}): Promise<void> {
  const ctx = deviceContext();
  await createRecord(LOGIN_TABLE, {
    user_id: input.userId ?? null,
    email: input.email ? sanitizeText(input.email, 200) : null,
    role: input.role ?? null,
    event: input.event,
    provider: input.provider ?? "password",
    success: input.success,
    reason: input.reason ? sanitizeText(input.reason, 200) : null,
    ip: ctx.ip,
    device_id: ctx.deviceId,
    device_label: ctx.label,
    browser: ctx.browser,
    os: ctx.os,
    platform: ctx.platform,
    user_agent: ctx.userAgent,
    created_at: new Date().toISOString(),
  }).catch(() => null);
}

export function listLoginHistory(userId: string, limit = 50) {
  return listTable<LoginRow>(LOGIN_TABLE, {
    select: LOGIN_SELECT, user_id: `eq.${userId}`, order: "created_at.desc", limit,
  }, { ttl: 30 });
}

export function listFailedLogins(hours = 24, limit = 200) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return listPage<LoginRow>(LOGIN_TABLE, 0, limit, {
    select: LOGIN_SELECT, success: "eq.false", created_at: `gte.${since}`, order: "created_at.desc",
  }, { ttl: 30 });
}

/** Last successful login for a user, for the "Last login" row in settings. */
export async function lastLogin(userId: string): Promise<LoginRow | null> {
  const rows = await listTable<LoginRow>(LOGIN_TABLE, {
    select: LOGIN_SELECT, user_id: `eq.${userId}`, success: "eq.true", order: "created_at.desc", limit: 1,
  }, { ttl: 60 }).catch(() => []);
  return rows[0] ?? null;
}

/* ------------------------------------------------------- account security */

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

const USER_SELECT =
  "id,email,role,name,phone,account_state,locked,lock_reason,locked_at,locked_by,suspended_until," +
  "suspension_reason,failed_login_count,last_failed_login_at,password_changed_at," +
  "deletion_requested_at,deletion_scheduled_for,deleted_at,marketing_opt_in,privacy_version,terms_version,created_at";

export async function fetchUserSecurity(userId: string): Promise<UserSecurityRow | null> {
  const rows = await listTable<UserSecurityRow>(USERS_TABLE, {
    select: USER_SELECT, id: `eq.${userId}`, limit: 1,
  }, { ttl: 15 }).catch(() => []);
  return rows[0] ?? null;
}

/** Is this account allowed to use the app right now? */
export function accountUsable(user: UserSecurityRow | null): { ok: boolean; reason?: string; state: AccountState } {
  const state = (user?.account_state as AccountState) ?? "active";
  if (!user) return { ok: true, state: "active" };
  if (user.deleted_at) return { ok: false, reason: "This account has been deleted.", state: "deleted" };
  if (user.locked || state === "locked") {
    return { ok: false, reason: user.lock_reason || "Your account is locked. Contact support.", state: "locked" };
  }
  if (state === "suspended") {
    const until = user.suspended_until ? Date.parse(user.suspended_until) : 0;
    if (!until || until > Date.now()) {
      return { ok: false, reason: user.suspension_reason || "Your account is suspended.", state: "suspended" };
    }
  }
  return { ok: true, state };
}

export async function lockAccount(userId: string, actor: { id: string; role?: string }, reason: string) {
  await patchRecord(USERS_TABLE, userId, {
    locked: true, account_state: "locked", lock_reason: sanitizeText(reason, 300),
    locked_at: new Date().toISOString(), locked_by: actor.id,
  });
  invalidateTable(USERS_TABLE);
  await revokeAllSessions(userId, actor, { reason: "account_locked" });
  await recordSecurityEvent({
    userId, type: "account_locked", severity: "critical",
    title: "Account locked", detail: reason, actorId: actor.id, actorRole: actor.role,
  });
}

export async function unlockAccount(userId: string, actor: { id: string; role?: string }) {
  await patchRecord(USERS_TABLE, userId, {
    locked: false, account_state: "active", lock_reason: null, failed_login_count: 0,
    suspended_until: null, suspension_reason: null,
  });
  invalidateTable(USERS_TABLE);
  await recordSecurityEvent({
    userId, type: "account_unlocked", severity: "warning",
    title: "Account unlocked", actorId: actor.id, actorRole: actor.role,
  });
}

/** Temporary suspension: `days` = 0 means permanent. */
export async function suspendAccount(
  userId: string, actor: { id: string; role?: string }, reason: string, days = 0,
) {
  const until = days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  await patchRecord(USERS_TABLE, userId, {
    account_state: "suspended", suspension_reason: sanitizeText(reason, 300), suspended_until: until,
    locked: days === 0, locked_at: new Date().toISOString(), locked_by: actor.id,
  });
  invalidateTable(USERS_TABLE);
  await revokeAllSessions(userId, actor, { reason: "account_suspended" });
  await recordSecurityEvent({
    userId, type: "account_suspended", severity: "critical",
    title: days > 0 ? `Suspended for ${days} day${days === 1 ? "" : "s"}` : "Suspended permanently",
    detail: reason, actorId: actor.id, actorRole: actor.role, meta: { days, until },
  });
}

export async function restoreAccount(userId: string, actor: { id: string; role?: string }) {
  await patchRecord(USERS_TABLE, userId, {
    account_state: "active", locked: false, lock_reason: null, suspended_until: null,
    suspension_reason: null, deletion_requested_at: null, deletion_scheduled_for: null,
    deleted_at: null, failed_login_count: 0,
  });
  invalidateTable(USERS_TABLE);
  await recordSecurityEvent({
    userId, type: "account_restored", severity: "warning",
    title: "Account restored", actorId: actor.id, actorRole: actor.role,
  });
}

/** Track a failed sign-in; auto-locks after `threshold` attempts. */
export async function noteFailedLogin(
  email: string, userId?: string | null, threshold = 8,
): Promise<{ locked: boolean; attempts: number }> {
  await recordLogin({ userId, email, event: "failed", success: false, reason: "invalid_credentials" });
  if (!userId) return { locked: false, attempts: 0 };

  const user = await fetchUserSecurity(userId);
  const attempts = (user?.failed_login_count ?? 0) + 1;
  await patchRecord(USERS_TABLE, userId, {
    failed_login_count: attempts, last_failed_login_at: new Date().toISOString(),
  }).catch(() => null);

  if (attempts >= threshold) {
    await lockAccount(userId, { id: "system", role: "system" }, `${attempts} consecutive failed sign-in attempts`);
    return { locked: true, attempts };
  }
  if (attempts >= 3) {
    await recordSecurityEvent({
      userId, type: "rate_limited", severity: "warning",
      title: `${attempts} failed sign-in attempts`, detail: "Repeated invalid credentials",
    });
  }
  return { locked: false, attempts };
}

export async function clearFailedLogins(userId: string) {
  await patchRecord(USERS_TABLE, userId, { failed_login_count: 0 }).catch(() => null);
}

/* --------------------------------------------------- credentials changes */

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  ok: boolean;
  issues: string[];
};

/** Local password policy check — run before hitting the auth backend. */
export function passwordStrength(password: string): PasswordStrength {
  const p = password ?? "";
  const issues: string[] = [];
  if (p.length < 8) issues.push("Use at least 8 characters");
  if (!/[a-z]/.test(p)) issues.push("Add a lowercase letter");
  if (!/[A-Z]/.test(p)) issues.push("Add an uppercase letter");
  if (!/\d/.test(p)) issues.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(p)) issues.push("Add a symbol");
  if (/^(?:password|123456|qwerty|scoobix)/i.test(p)) issues.push("Too common");

  const passed = 5 - Math.min(5, issues.length);
  const score = Math.max(0, Math.min(4, passed - 1)) as PasswordStrength["score"];
  const labels: PasswordStrength["label"][] = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  return { score, label: labels[score], ok: p.length >= 8 && issues.length <= 1, issues };
}

/** Record that a password changed and sign other devices out. */
export async function notePasswordChanged(userId: string, role?: string) {
  await patchRecord(USERS_TABLE, userId, { password_changed_at: new Date().toISOString() }).catch(() => null);
  await revokeAllSessions(userId, { id: userId, role }, {
    exceptSessionId: localSessionId() ?? undefined, reason: "password_changed",
  });
  await recordSecurityEvent({
    userId, role, type: "password_changed", severity: "warning",
    title: "Password changed", detail: "Other devices were signed out",
  });
}

export async function noteContactChanged(
  userId: string, kind: "email" | "phone", value: string, role?: string,
) {
  await recordSecurityEvent({
    userId, role, type: kind === "email" ? "email_changed" : "phone_changed", severity: "warning",
    title: `${kind === "email" ? "Email" : "Phone number"} changed`,
    detail: kind === "email" ? sanitizeText(value, 200) : sanitizeText(value, 20),
  });
}

/* -------------------------------------------------------- deletion flow */

export async function requestAccountDeletion(userId: string, role?: string, graceDays = 14) {
  const scheduled = new Date(Date.now() + graceDays * 86400_000).toISOString();
  await patchRecord(USERS_TABLE, userId, {
    account_state: "pending_deletion",
    deletion_requested_at: new Date().toISOString(),
    deletion_scheduled_for: scheduled,
  });
  invalidateTable(USERS_TABLE);
  await recordSecurityEvent({
    userId, role, type: "deletion_requested", severity: "critical",
    title: "Account deletion requested",
    detail: `Scheduled for ${new Date(scheduled).toLocaleDateString()}`,
    meta: { graceDays, scheduled },
  });
  return scheduled;
}

export async function cancelAccountDeletion(userId: string, role?: string) {
  await patchRecord(USERS_TABLE, userId, {
    account_state: "active", deletion_requested_at: null, deletion_scheduled_for: null,
  });
  invalidateTable(USERS_TABLE);
  await recordSecurityEvent({
    userId, role, type: "deletion_cancelled", severity: "warning", title: "Account deletion cancelled",
  });
}

export function listDeletionRequests(limit = 100) {
  return listTable<UserSecurityRow>(USERS_TABLE, {
    select: USER_SELECT, account_state: "eq.pending_deletion", order: "deletion_requested_at.asc", limit,
  }, { ttl: 60 });
}

/* --------------------------------------------------------------- consent */

export async function recordConsent(input: {
  userId: string; kind: ConsentKind; granted: boolean; version?: string; source?: string;
}) {
  const ctx = deviceContext();
  const now = new Date().toISOString();
  await createRecord(CONSENT_TABLE, {
    user_id: input.userId,
    kind: input.kind,
    version: input.version ?? "1.0",
    granted: input.granted,
    source: input.source ?? "settings",
    ip: ctx.ip,
    device_id: ctx.deviceId,
    updated_at: now,
    created_at: now,
  }).catch(() => null);

  if (input.kind === "privacy_policy") await patchRecord(USERS_TABLE, input.userId, { privacy_version: input.version ?? "1.0" }).catch(() => null);
  if (input.kind === "terms") await patchRecord(USERS_TABLE, input.userId, { terms_version: input.version ?? "1.0" }).catch(() => null);
  if (input.kind.startsWith("marketing")) await patchRecord(USERS_TABLE, input.userId, { marketing_opt_in: input.granted }).catch(() => null);

  logAudit({
    action: "privacy.consent", category: "privacy", actorId: input.userId,
    subjectType: "user", subjectId: input.userId,
    summary: `${input.granted ? "Granted" : "Withdrew"} ${input.kind}`,
  });
}

/** Latest consent state per kind. */
export async function consentState(userId: string): Promise<Record<string, ConsentRow>> {
  const rows = await listTable<ConsentRow>(CONSENT_TABLE, {
    select: "id,user_id,kind,version,granted,source,updated_at,created_at",
    user_id: `eq.${userId}`, order: "created_at.desc", limit: 100,
  }, { ttl: 60 }).catch(() => []);
  const out: Record<string, ConsentRow> = {};
  for (const r of rows) if (r.kind && !out[r.kind]) out[r.kind] = r;
  return out;
}

/* --------------------------------------------------------- data privacy */

/** Assemble everything Scoobix holds about a user, for "Export my data". */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const scoped = async (table: string, column: string, select = "*") =>
    listTable(table, { select, [column]: `eq.${userId}`, limit: 500 }, { ttl: 0 }).catch(() => []);

  const [profile, orders, addresses, wallet, coupons, tickets, sessions, logins, consents, audit] = await Promise.all([
    fetchUserSecurity(userId),
    scoped("orders", "user_id"),
    scoped("addresses", "user_id"),
    scoped("wallet_transactions", "user_id"),
    scoped("coupon_usage", "user_id"),
    scoped("support_tickets", "user_id"),
    listSessions(userId, { includeRevoked: true }).catch(() => []),
    listLoginHistory(userId, 200).catch(() => []),
    consentState(userId).catch(() => ({})),
    subjectTrail("user", userId, 200).catch(() => []),
  ]);

  await recordSecurityEvent({
    userId, type: "data_exported", severity: "warning",
    title: "Personal data exported", detail: "User requested a copy of their data",
  });

  return {
    exportedAt: new Date().toISOString(),
    profile,
    orders,
    addresses,
    walletTransactions: wallet,
    couponUsage: coupons,
    supportTickets: tickets,
    sessions,
    loginHistory: logins,
    consents,
    activity: audit,
  };
}

/* -------------------------------------------------- permission overrides */

export type OverrideInput = {
  userId: string; permission: Permission; effect: "grant" | "deny";
  reason?: string; expiresAt?: string | null;
};

export async function listPermissionOverrides(userId?: string, limit = 200) {
  const params: Record<string, string | number> = {
    select: "id,user_id,role,permission,effect,reason,granted_by,expires_at,active,created_at",
    order: "created_at.desc", limit,
  };
  if (userId) params.user_id = `eq.${userId}`;
  return listTable(OVERRIDES_TABLE, params, { ttl: 30 });
}

export async function setPermissionOverride(input: OverrideInput, actor: { id: string; role?: string }) {
  const now = new Date().toISOString();
  await createRecord(OVERRIDES_TABLE, {
    user_id: input.userId,
    permission: input.permission,
    effect: input.effect,
    reason: input.reason ? sanitizeText(input.reason, 300) : null,
    granted_by: actor.id,
    expires_at: input.expiresAt ?? null,
    active: true,
    updated_at: now,
    created_at: now,
  });
  clearOverrideCache(input.userId);
  clearElevationCache(input.userId);
  invalidateTable(OVERRIDES_TABLE);
  await recordSecurityEvent({
    userId: input.userId, type: "permission_changed", severity: "critical",
    title: `${input.effect === "grant" ? "Granted" : "Denied"} ${input.permission}`,
    detail: input.reason, actorId: actor.id, actorRole: actor.role,
  });
}

export async function removePermissionOverride(id: string, userId: string, actor: { id: string; role?: string }) {
  await deleteRecord(OVERRIDES_TABLE, id);
  clearOverrideCache(userId);
  invalidateTable(OVERRIDES_TABLE);
  await recordSecurityEvent({
    userId, type: "permission_changed", severity: "warning",
    title: "Permission override removed", actorId: actor.id, actorRole: actor.role,
  });
}

/* ------------------------------------------------------- login bootstrap */

/**
 * Everything that must happen after a successful authentication:
 * session row, device touch, login history, and a "new device" alert.
 * Failures never block sign-in.
 */
export async function onLoginSuccess(input: {
  userId: string; email?: string | null; role: string; provider?: string;
}): Promise<void> {
  try {
    const ctx = deviceContext();
    const known = await listTable<DeviceRow>(DEVICES_TABLE, {
      select: "id", user_id: `eq.${input.userId}`, device_id: `eq.${ctx.deviceId}`, limit: 1,
    }, { fresh: true }).catch(() => []);

    await Promise.all([
      startSession(input.userId, input.role),
      recordLogin({
        userId: input.userId, email: input.email, role: input.role,
        event: input.provider && input.provider !== "password" ? "oauth" : "login",
        provider: input.provider, success: true,
      }),
      clearFailedLogins(input.userId),
    ]);

    if (!known.length) {
      await recordSecurityEvent({
        userId: input.userId, role: input.role, type: "new_login", severity: "warning",
        title: `New sign-in from ${ctx.label}`,
        detail: `${ctx.platform} · ${ctx.ip ?? "unknown IP"}`,
        meta: { deviceId: ctx.deviceId, app: currentApp() },
      });
    }
    logAudit({
      action: "auth.login", category: "auth", actorId: input.userId, actorRole: input.role,
      subjectType: "user", subjectId: input.userId,
      summary: `Signed in via ${input.provider ?? "password"}`,
    });
  } catch { /* auditing must never break login */ }
}

/** Summary tiles for the admin security dashboard. */
export async function securityOverview() {
  const [events, failed, sessions, devices, deletions] = await Promise.all([
    listSecurityEvents({ onlyOpen: true, limit: 200 }).catch(() => []),
    listFailedLogins(24, 200).catch(() => []),
    listAllActiveSessions(200).catch(() => []),
    listDevices(undefined, 200).catch(() => []),
    listDeletionRequests(50).catch(() => []),
  ]);
  const lockedUsers = await listTable<UserSecurityRow>(USERS_TABLE, {
    select: USER_SELECT, locked: "eq.true", order: "locked_at.desc", limit: 100,
  }, { ttl: 60 }).catch(() => []);

  const byPlatform = new Map<string, number>();
  for (const s of sessions) byPlatform.set(s.platform ?? "unknown", (byPlatform.get(s.platform ?? "unknown") ?? 0) + 1);

  return {
    openAlerts: events.length,
    criticalAlerts: events.filter((e) => e.severity === "critical").length,
    failedLogins24h: failed.length,
    activeSessions: sessions.length,
    deviceCount: devices.length,
    blockedDevices: devices.filter((d) => d.blocked).length,
    lockedAccounts: lockedUsers.length,
    pendingDeletions: deletions.length,
    events,
    failedList: failed,
    sessionList: sessions,
    deviceList: devices,
    lockedUsers,
    deletions,
    deviceSummary: [...byPlatform.entries()].map(([id, value]) => ({ id, label: id, value })),
  };

}

/** Batch-create security events (used by the fraud scanner). */
export function recordSecurityEvents(rows: Record<string, unknown>[]) {
  if (!rows.length) return Promise.resolve(null);
  return createRecords(EVENTS_TABLE, rows).catch(() => null);
}

export type { SecurityRole };
