/**
 * Session management, account security, security events, consent and privacy.
 *
 * SCOOBIX RESET: Minimal business stubs for unauthenticated access.
 */
import {
  createRecord, invalidateTable,
  listPage, listTable, patchRecord, patchWhereIn,
} from "./insforge-crud";
import { logAudit } from "./audit-api";
import { currentApp, deviceContext, resolveIp } from "./device-context";
import { type Permission, type SecurityRole } from "./permissions";
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

export type AccountState = "active" | "locked" | "suspended" | "pending_deletion" | "deleted";

export const SESSIONS_TABLE = "user_sessions";
export const LOGIN_TABLE = "login_history";
export const EVENTS_TABLE = "security_events";
export const DEVICES_TABLE = "device_registry";
export const CONSENT_TABLE = "consent_records";
export const OVERRIDES_TABLE = "permission_overrides";
export const USERS_TABLE = "users";

const LOCAL_SESSION_KEY = "scoobix.security.session_row";

/* -------------------------------------------------------- security events */

export async function recordSecurityEvent(input: any): Promise<SecurityEventRow | null> {
  return null;
}

export function listSecurityEvents(opts: any = {}) {
  return Promise.resolve([]);
}

export async function acknowledgeSecurityEvents(ids: string[], adminId: string) {
  return;
}

/* --------------------------------------------------------- device registry */

export async function touchDevice(userId: string, opts: any = {}): Promise<DeviceRow | null> {
  return null;
}

export function listDevices(userId?: string, limit = 100) {
  return Promise.resolve([]);
}

export async function setDeviceFlags(id: string, flags: { trusted?: boolean; blocked?: boolean }) {
  return;
}

/* ------------------------------------------------------------- sessions */

export function localSessionId(): string | null {
  return null;
}

export async function startSession(userId: string, role: string): Promise<SessionRow | null> {
  return null;
}

export async function heartbeatSession(): Promise<void> {
  return;
}

export function listSessions(userId: string, opts: any = {}) {
  return Promise.resolve([]);
}

export function listAllActiveSessions(limit = 200) {
  return Promise.resolve([]);
}

export async function revokeSession(sessionId: string, actor: any, reason = "manual") {
  return;
}

export async function revokeAllSessions(userId: string, actor: any, opts: any = {}): Promise<number> {
  return 0;
}

export async function endCurrentSession(userId?: string | null) {
  return;
}

/* -------------------------------------------------------- login history */

export async function recordLogin(input: any): Promise<void> {
  return;
}

export function listLoginHistory(userId: string, limit = 50) {
  return Promise.resolve([]);
}

export function listFailedLogins(hours = 24, limit = 200) {
  return Promise.resolve([]);
}

export async function lastLogin(userId: string): Promise<LoginRow | null> {
  return null;
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

export async function fetchUserSecurity(userId: string): Promise<UserSecurityRow | null> {
  return null;
}

export function accountUsable(user: UserSecurityRow | null): { ok: boolean; reason?: string; state: AccountState } {
  return { ok: true, state: "active" };
}

export async function lockAccount(userId: string, actor: any, reason: string) {
  return;
}
