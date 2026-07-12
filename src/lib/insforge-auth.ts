/**
 * InsForge Auth client — thin wrapper around the InsForge auth endpoints.
 * Used by `auth-store.tsx` to power real authentication for all four apps
 * (customer, restaurant/partner, driver/rider, admin).
 *
 * We use `client_type=mobile` so refresh tokens come back in the body
 * (cross-origin cookies are unreliable across the preview + published hosts).
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const ACCESS_KEY = "scoobix_if_access_v1";
const REFRESH_KEY = "scoobix_if_refresh_v1";

export type DbRole = "customer" | "restaurant" | "driver" | "admin";

export type InsForgeUser = {
  id: string;
  email: string;
  profile?: { name?: string; avatar_url?: string } & Record<string, unknown>;
  emailVerified?: boolean;
};

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
function setTokens(access: string | null, refresh: string | null) {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access); else localStorage.removeItem(ACCESS_KEY);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh); else localStorage.removeItem(REFRESH_KEY);
  } catch { /* ignore */ }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: `Bearer ${token ?? INSFORGE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${INSFORGE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

async function jsonOrThrow(res: Response): Promise<any> {
  let body: any = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

// ---------- auth actions ----------

export async function ifSignup(email: string, password: string, name: string): Promise<{
  user: InsForgeUser; accessToken: string | null; refreshToken: string | null; requireEmailVerification?: boolean;
}> {
  const res = await raw(`/api/auth/users?client_type=mobile`, {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  const data = await jsonOrThrow(res);
  setTokens(data.accessToken ?? null, data.refreshToken ?? null);
  return data;
}

export async function ifLogin(email: string, password: string): Promise<{
  user: InsForgeUser; accessToken: string; refreshToken: string | null;
}> {
  const res = await raw(`/api/auth/sessions?client_type=mobile`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await jsonOrThrow(res);
  setTokens(data.accessToken ?? null, data.refreshToken ?? null);
  return data;
}

export async function ifLogout(): Promise<void> {
  try { await raw(`/api/auth/logout`, { method: "POST" }); } catch { /* */ }
  setTokens(null, null);
}

export async function ifGetSession(): Promise<InsForgeUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await raw(`/api/auth/sessions/current`, { method: "GET" });
  if (res.status === 401) {
    const refreshed = await ifRefresh();
    if (!refreshed) return null;
    const res2 = await raw(`/api/auth/sessions/current`, { method: "GET" });
    if (!res2.ok) return null;
    const body2 = await res2.json();
    return normalizeSession(body2);
  }
  if (!res.ok) return null;
  const body = await res.json();
  return normalizeSession(body);
}

function normalizeSession(body: any): InsForgeUser | null {
  if (!body) return null;
  if (body.user) return body.user as InsForgeUser;
  if (body.id) return body as InsForgeUser;
  return null;
}

export async function ifRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${INSFORGE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { apikey: INSFORGE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { setTokens(null, null); return false; }
  const body = await res.json().catch(() => null);
  if (!body?.accessToken) return false;
  setTokens(body.accessToken, body.refreshToken ?? refreshToken);
  return true;
}

export async function ifSendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const res = await raw(`/api/auth/email/send-reset-password`, {
    method: "POST",
    body: JSON.stringify({ email, ...(redirectTo ? { redirectTo } : {}) }),
  });
  await jsonOrThrow(res);
}

// ---------- public.users profile row ----------

export type UserProfileRow = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: DbRole | string;
  avatar_url?: string;
};

export async function fetchUserProfile(userId: string): Promise<UserProfileRow | null> {
  try {
    const res = await raw(`/api/database/records/users/${userId}`, { method: "GET" });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? (body[0] ?? null) : body;
  } catch { return null; }
}

export async function upsertUserProfile(row: UserProfileRow): Promise<void> {
  // Try PATCH first, fall back to POST insert.
  const patch = await raw(`/api/database/records/users/${row.id}`, {
    method: "PATCH",
    body: JSON.stringify(row),
  });
  if (patch.ok) return;
  await raw(`/api/database/records/users`, {
    method: "POST",
    body: JSON.stringify(row),
  }).catch(() => null);
}
