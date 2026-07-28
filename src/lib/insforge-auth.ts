/**
 * InsForge Auth client — thin wrapper around the InsForge auth endpoints.
 * Used by `auth-store.tsx` to power real authentication for all four apps
 * (customer, restaurant/partner, driver/rider, admin).
 *
 * Supported here: email + password, email verification (6-digit code or link),
 * password reset, and OAuth (Google / Apple / any provider enabled in the
 * InsForge dashboard) using the PKCE flow. Phone OTP lives in `phone-otp.ts`.
 *
 * We use `client_type=mobile` so refresh tokens come back in the body
 * (cross-origin cookies are unreliable across the preview + published hosts).
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const ACCESS_KEY = "scoobix_if_access_v1";
const REFRESH_KEY = "scoobix_if_refresh_v1";
const PKCE_KEY = "scoobix_if_pkce_v1";
const OAUTH_META_KEY = "scoobix_if_oauth_meta_v1";

export type DbRole = "customer" | "restaurant" | "driver" | "admin";

/** OAuth providers wired into the login screens. */
export type OAuthProvider = "google" | "apple";

export type InsForgeUser = {
  id: string;
  email: string;
  profile?: { name?: string; avatar_url?: string } & Record<string, unknown>;
  emailVerified?: boolean;
  providers?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setTokens(access: string | null, refresh: string | null) {
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
  if (body && body.error && !body.data) {
    throw new Error(body.error.message || body.message || "Request failed");
  }
  // Some deployments wrap the payload in `{ data, error }` (SDK shape),
  // others return it flat. Always work with the flat payload.
  return body && typeof body === "object" && body.data && (body.data.user || body.data.accessToken)
    ? body.data
    : body;
}

/**
 * Guarantees an authenticated user object. Auth endpoints occasionally return
 * only tokens (no `user`), which used to crash callers with
 * "Cannot read properties of undefined (reading 'id')".
 */
async function ensureSessionUser(data: any, context: string): Promise<InsForgeUser> {
  const direct = normalizeSession(data);
  if (direct?.id) return direct;
  const fetched = await ifGetSession().catch(() => null);
  if (fetched?.id) return fetched;
  throw new Error(`${context} did not return an account. Please try again.`);
}

// ---------- email + password ----------

export async function ifSignup(email: string, password: string, name: string, redirectTo?: string): Promise<{
  user: InsForgeUser | null; accessToken: string | null; refreshToken: string | null; requireEmailVerification?: boolean;
}> {
  const res = await raw(`/api/auth/users?client_type=mobile`, {
    method: "POST",
    body: JSON.stringify({ email, password, name, ...(redirectTo ? { redirectTo } : {}) }),
  });
  const data = await jsonOrThrow(res);
  setTokens(data?.accessToken ?? null, data?.refreshToken ?? null);
  const requireEmailVerification = !!data?.requireEmailVerification || !data?.accessToken;
  // Without an access token there is no session yet — the caller must not
  // attempt profile creation, so `user` may legitimately be null.
  const user = requireEmailVerification
    ? normalizeSession(data)
    : await ensureSessionUser(data, "Sign up");
  return { ...data, user, requireEmailVerification };
}

export async function ifLogin(email: string, password: string): Promise<{
  user: InsForgeUser; accessToken: string; refreshToken: string | null;
}> {
  const res = await raw(`/api/auth/sessions?client_type=mobile`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await jsonOrThrow(res);
  setTokens(data?.accessToken ?? null, data?.refreshToken ?? null);
  const user = await ensureSessionUser(data, "Sign in");
  return { ...data, user };
}


export async function ifLogout(): Promise<void> {
  // Revokes the server-side session for every provider linked to the account.
  try { await raw(`/api/auth/sessions/current`, { method: "DELETE" }); } catch { /* */ }
  try { await raw(`/api/auth/logout`, { method: "POST" }); } catch { /* */ }
  setTokens(null, null);
  try {
    sessionStorage.removeItem(PKCE_KEY);
    sessionStorage.removeItem(OAUTH_META_KEY);
  } catch { /* */ }
}

export async function ifGetSession(): Promise<InsForgeUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await raw(`/api/auth/sessions/current`, { method: "GET" });
  if (res.status === 401 || res.status === 403) {
    // Expired or revoked access token — try the refresh token once.
    const refreshed = await ifRefresh();
    if (!refreshed) return null;
    const res2 = await raw(`/api/auth/sessions/current`, { method: "GET" });
    if (!res2.ok) { setTokens(null, null); return null; }
    return normalizeSession(await res2.json());
  }
  if (!res.ok) return null;
  return normalizeSession(await res.json());
}

function normalizeSession(body: any): InsForgeUser | null {
  if (!body || typeof body !== "object") return null;
  const candidates = [body.user, body.data?.user, body.data, body];
  for (const c of candidates) {
    if (c && typeof c === "object" && typeof c.id === "string" && c.id) return c as InsForgeUser;
  }
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
  if (!body?.accessToken) { setTokens(null, null); return false; }
  setTokens(body.accessToken, body.refreshToken ?? refreshToken);
  return true;
}

// ---------- email verification ----------

export async function ifVerifyEmail(email: string, otp: string): Promise<InsForgeUser | null> {
  const res = await raw(`/api/auth/email/verify?client_type=mobile`, {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  const data = await jsonOrThrow(res);
  if (data?.accessToken) setTokens(data.accessToken, data.refreshToken ?? null);
  return normalizeSession(data);
}

export async function ifResendVerificationEmail(email: string, redirectTo?: string): Promise<void> {
  const res = await raw(`/api/auth/email/resend-verification`, {
    method: "POST",
    body: JSON.stringify({ email, ...(redirectTo ? { redirectTo } : {}) }),
  });
  await jsonOrThrow(res);
}

export async function ifSendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const res = await raw(`/api/auth/email/send-reset-password`, {
    method: "POST",
    body: JSON.stringify({ email, ...(redirectTo ? { redirectTo } : {}) }),
  });
  await jsonOrThrow(res);
}

// ---------- OAuth (PKCE) ----------

function randomVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Begin OAuth. Redirects the browser to the provider's consent screen; the
 * provider returns to `redirectUri` with `?insforge_code=…`, which
 * `ifCompleteOAuth` exchanges for a session.
 */
export async function ifStartOAuth(
  provider: OAuthProvider,
  redirectUri: string,
  meta?: Record<string, string>,
): Promise<void> {
  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  try {
    sessionStorage.setItem(PKCE_KEY, verifier);
    sessionStorage.setItem(OAUTH_META_KEY, JSON.stringify({ provider, ...(meta ?? {}) }));
  } catch { /* */ }

  const url = new URL(`${INSFORGE_URL}/api/auth/oauth/${provider}`);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  const res = await fetch(url.toString(), { headers: { apikey: INSFORGE_ANON_KEY } });
  const data = await jsonOrThrow(res);
  const authUrl =
    data?.authUrl ??
    data?.url ??
    data?.authorizationUrl ??
    data?.redirectUrl ??
    data?.data?.authUrl ??
    data?.data?.url ??
    data?.data?.authorizationUrl ??
    data?.data?.redirectUrl;
  if (typeof authUrl !== "string" || !/^https?:\/\//i.test(authUrl)) {
    throw new Error("Could not start sign-in with this provider");
  }
  window.location.assign(authUrl);
}

export type OAuthCallback = {
  code: string;
  provider: OAuthProvider | string;
  meta: Record<string, string>;
};

/** Detects an OAuth return in the current URL (does not consume it). */
export function readOAuthCallback(search: string = typeof window !== "undefined" ? window.location.search : ""): OAuthCallback | null {
  const params = new URLSearchParams(search);
  const code = params.get("insforge_code") ?? params.get("code");
  if (!code) return null;
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(sessionStorage.getItem(OAUTH_META_KEY) ?? "{}"); } catch { /* */ }
  return { code, provider: meta.provider ?? params.get("provider") ?? "google", meta };
}

/** Exchanges the returned code + stored PKCE verifier for a session. */
export async function ifCompleteOAuth(code: string): Promise<{ user: InsForgeUser; isNewUser?: boolean }> {
  let verifier = "";
  try { verifier = sessionStorage.getItem(PKCE_KEY) ?? ""; } catch { /* */ }
  if (!verifier) throw new Error("Sign-in session expired — please try again");
  const res = await fetch(`${INSFORGE_URL}/api/auth/oauth/exchange?client_type=mobile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: INSFORGE_ANON_KEY },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });
  const data = await jsonOrThrow(res);
  setTokens(data.accessToken ?? null, data.refreshToken ?? null);
  try { sessionStorage.removeItem(PKCE_KEY); } catch { /* */ }
  const user = await ensureSessionUser(data, "Provider sign-in");
  return { user, isNewUser: !!data.isNewUser };
}

/** Strips OAuth params from the address bar without a navigation. */
export function clearOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let touched = false;
  for (const key of ["insforge_code", "code", "state", "insforge_status", "insforge_type", "insforge_error", "error", "error_description"]) {
    if (url.searchParams.has(key)) { url.searchParams.delete(key); touched = true; }
  }
  if (touched) window.history.replaceState({}, "", url.toString());
}

// ---------- public.users profile row ----------

export type UserProfileRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: DbRole | string | null;
  avatar?: string | null;
  status?: string | null;
  provider?: string | null;
  providers?: string | null;
  email_verified?: boolean | null;
  last_login_at?: string | null;
  referral_code?: string | null;
  wallet_balance?: number | null;
  loyalty_points?: number | null;
  metadata?: Record<string, unknown> | null;
  registration_timestamp?: string | null;
};

export async function fetchUserProfile(userId: string): Promise<UserProfileRow | null> {
  try {
    const res = await raw(`/api/database/records/users?id=eq.${userId}&limit=1`, { method: "GET" });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? (body[0] ?? null) : body;
  } catch { return null; }
}

/** Finds an existing account row by email so providers never fork an account. */
export async function findUserProfileByEmail(email: string): Promise<UserProfileRow | null> {
  if (!email) return null;
  try {
    const res = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}&limit=1`, { method: "GET" });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? (body[0] ?? null) : body;
  } catch { return null; }
}

/** The `users.role` check constraint stores roles in UPPER CASE. */
export function dbRoleValue(role: string | null | undefined): string {
  return String(role ?? "customer").toUpperCase();
}

function cleanRow(row: UserProfileRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[k] = v;
  if (out.role) out.role = dbRoleValue(out.role as string);
  return out;
}

/**
 * Creates or updates the `public.users` row and ALWAYS returns the stored row
 * (self-healing: an auth account that lost/never had a profile gets one here).
 * Returns null only when the backend rejects both write attempts.
 */
export async function upsertUserProfile(row: UserProfileRow): Promise<UserProfileRow | null> {
  const payload = cleanRow(row);
  // PATCH silently succeeds with 0 rows affected, so check existence first.
  const existing = await fetchUserProfile(row.id);
  if (existing) {
    const { id: _omit, registration_timestamp: _ts, ...patch } = payload as Record<string, unknown>;
    const res = await raw(`/api/database/records/users?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res || !res.ok) console.warn("[auth] profile update failed", await res?.text?.().catch(() => ""));
    return (await fetchUserProfile(row.id)) ?? { ...existing, ...(patch as UserProfileRow) };
  }

  const insert = { registration_timestamp: new Date().toISOString(), ...payload };
  const res = await raw(`/api/database/records/users`, {
    method: "POST",
    body: JSON.stringify(insert),
  }).catch(() => null);
  if (!res || !res.ok) {
    console.warn("[auth] profile create failed", await res?.text?.().catch(() => ""));
  }
  // Re-read: another tab / concurrent login may have created it first.
  return (await fetchUserProfile(row.id)) ?? (res?.ok ? (insert as UserProfileRow) : null);
}


/** Stable, human-friendly referral code derived from the account id. */
export function referralCodeFor(userId: string, name?: string | null): string {
  const prefix = (name ?? "SCOO").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase();
  return `${prefix}${suffix}`;
}
