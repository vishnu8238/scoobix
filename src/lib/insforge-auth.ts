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

/**
 * OAuth hand-off state must survive the provider round-trip. Apple uses
 * `response_mode=form_post`, and on some browsers (notably iOS Safari and
 * in-app webviews) the return lands in a *new* browsing context where
 * `sessionStorage` is empty. Mirror everything into `localStorage` too.
 */
function writeCookie(key: string, value: string, maxAge = 600) {
  try {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${key}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch { /* */ }
}
function readCookie(key: string): string {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${key}=`));
    return hit ? decodeURIComponent(hit.slice(key.length + 1)) : "";
  } catch { return ""; }
}
function clearCookie(key: string) {
  try { document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`; } catch { /* */ }
}

function stashOAuthState(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* */ }
  try { localStorage.setItem(key, value); } catch { /* */ }
  // iOS Safari / in-app webviews can hand the form_post return to a fresh
  // browsing context with partitioned (empty) web storage. A first-party
  // SameSite=Lax cookie survives that hop, so mirror the state there too.
  writeCookie(key, value);
}
function readOAuthState(key: string): string {
  try { const v = sessionStorage.getItem(key); if (v) return v; } catch { /* */ }
  try { const v = localStorage.getItem(key); if (v) return v; } catch { /* */ }
  return readCookie(key);
}
function dropOAuthState(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* */ }
  try { localStorage.removeItem(key); } catch { /* */ }
  clearCookie(key);
}


export type DbRole = "customer" | "restaurant" | "driver" | "admin" | "merchant_manager";

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
  console.log("[auth] Updating tokens in storage:", access ? "ACCESS_PRESENT" : "ACCESS_MISSING", refresh ? "REFRESH_PRESENT" : "REFRESH_MISSING");
  if (!access) {
    console.trace("[auth] setTokens called with null access token");
  }
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access); else localStorage.removeItem(ACCESS_KEY);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh); else localStorage.removeItem(REFRESH_KEY);
  } catch (e) {
    console.error("[auth] localStorage write failed", e);
  }
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
  console.log("[auth] ifLogin request for:", email);
  try {
    const res = await raw(`/api/auth/sessions?client_type=mobile`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    console.log("[auth] ifLogin HTTP Status:", res.status);
    const data = await jsonOrThrow(res);
    console.log("[auth] ifLogin Success (data parsed), tokens:", {
      access: !!data?.accessToken,
      refresh: !!data?.refreshToken
    });
    
    if (data?.accessToken) {
      console.log("[auth] Calling setTokens explicitly...");
      setTokens(data.accessToken, data.refreshToken ?? null);
      
      const verify = localStorage.getItem(ACCESS_KEY);
      console.log("[auth] Verification read-back from localStorage:", verify ? "SUCCESS" : "FAILED");
      
      if (!verify) {
        console.error("[auth] CRITICAL: localStorage write failed to persist!");
      }
    } else {
      console.error("[auth] No accessToken returned in successful login response");
    }

    const user = await ensureSessionUser(data, "Sign in");
    console.log("[auth] ifLogin session user resolved:", user.id);
    return { ...data, user };
  } catch (error) {
    console.error("[auth] ifLogin FAILED:", error);
    throw error;
  }
}



export async function ifLogout(): Promise<void> {
  // Revokes the server-side session for every provider linked to the account.
  try { await raw(`/api/auth/sessions/current`, { method: "DELETE" }); } catch { /* */ }
  try { await raw(`/api/auth/logout`, { method: "POST" }); } catch { /* */ }
  
  // Hardened cleanup: Clear all auth-related local state and cookies
  setTokens(null, null);
  dropOAuthState(PKCE_KEY);
  dropOAuthState(OAUTH_META_KEY);
  
  // Clear any potential leftover auth cookies and portal states
  clearCookie("insforge-auth-token");
  clearCookie("sb-access-token");
  clearCookie("sb-refresh-token");
  
  try {
    localStorage.removeItem("scoobix_active_portal_v1");
    localStorage.removeItem("scoobix_role_v1");
    localStorage.removeItem("scoobix_pending_role_v1");
    sessionStorage.removeItem("scoobix_active_portal_v1");
    sessionStorage.removeItem("scoobix_pending_role_v1");
  } catch { /* ignore */ }
}

export async function ifGetSession(): Promise<InsForgeUser | null> {
  const token = getAccessToken();
  console.log("[auth] ifGetSession check, local access token exists:", !!token);
  if (!token) return null;

  const res = await raw(`/api/auth/sessions/current`, { method: "GET" });
  if (res.status === 401 || res.status === 403) {
    console.log("[auth] Access token expired, attempting refresh...");
    // Expired or revoked access token — try the refresh token once.
    const refreshed = await ifRefresh();
    if (!refreshed) {
      console.log("[auth] Refresh failed, session is null.");
      return null;
    }
    const res2 = await raw(`/api/auth/sessions/current`, { method: "GET" });
    if (!res2.ok) {
      console.log("[auth] Session check failed after refresh:", res2.status);
      setTokens(null, null);
      return null;
    }
    const data = normalizeSession(await res2.json());
    console.log("[auth] Session restored after refresh:", data?.id);
    return data;
  }
  if (!res.ok) {
    console.log("[auth] Session check failed with status:", res.status);
    return null;
  }
  const data = normalizeSession(await res.json());
  console.log("[auth] Session found:", data?.id);
  return data;
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
  console.log("[auth] ifRefresh check, local refresh token exists:", !!refreshToken);
  if (!refreshToken) return false;

  const res = await fetch(`${INSFORGE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { apikey: INSFORGE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    console.log("[auth] Refresh request failed:", res.status);
    setTokens(null, null);
    return false;
  }
  const body = await res.json().catch(() => null);
  if (!body?.accessToken) {
    console.log("[auth] Refresh response missing access token.");
    setTokens(null, null);
    return false;
  }
  console.log("[auth] Refresh successful, updating tokens.");
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

/**
 * Change the signed-in user's password. Requires the current password so a
 * stolen session alone cannot take over the account.
 */
export async function ifChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const session = await ifGetSession();
  if (!session?.email) throw new Error("You are not signed in");
  // Re-authenticate first; this both proves ownership and refreshes the token.
  await ifLogin(session.email, currentPassword);
  const res = await raw(`/api/auth/users/current`, {
    method: "PATCH",
    body: JSON.stringify({ password: newPassword }),
  });
  await jsonOrThrow(res);
}

/** Update the signed-in user's email or phone on the auth record. */
export async function ifUpdateAuthContact(patch: { email?: string; phone?: string }): Promise<void> {
  const res = await raw(`/api/auth/users/current`, {
    method: "PATCH",
    body: JSON.stringify(patch),
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
  queryParams?: Record<string, string>,
): Promise<void> {
  const authUrl = await ifCreateOAuthUrl(provider, redirectUri, meta, queryParams);
  navigateToOAuthUrl(authUrl);
}

/**
 * Creates the provider URL and stores the PKCE hand-off state. Kept separate
 * so callers can open a popup synchronously, then assign its URL after fetch.
 */
export async function ifCreateOAuthUrl(
  provider: OAuthProvider,
  redirectUri: string,
  meta?: Record<string, string>,
  queryParams?: Record<string, string>,
): Promise<string> {
  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  stashOAuthState(PKCE_KEY, verifier);
  stashOAuthState(OAUTH_META_KEY, JSON.stringify({ provider, ...(meta ?? {}) }));

  const url = new URL(`${INSFORGE_URL}/api/auth/oauth/${provider}`);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (queryParams) {
    Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
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
  return authUrl;
}

export function navigateToOAuthUrl(authUrl: string) {
  if (typeof window === "undefined") return;
  try {
    if (window.self !== window.top) {
      window.open(authUrl, "_top");
      return;
    }
  } catch { /* cross-origin frame access can throw */ }
  window.location.assign(authUrl);
}

export type OAuthCallback = {
  code: string;
  provider: OAuthProvider | string;
  meta: Record<string, string>;
};

/**
 * Snapshot of the URL as the document was first loaded.
 *
 * The router's `validateSearch` normalises the address bar (dropping unknown
 * params such as `insforge_code`) before React effects run, so reading
 * `window.location.search` later loses the OAuth callback entirely.
 */
const INITIAL_SEARCH = typeof window !== "undefined" ? window.location.search : "";
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

function paramsFromLocation(search?: string): URLSearchParams {
  const liveSearch = typeof window !== "undefined" ? window.location.search : "";
  const liveHash = typeof window !== "undefined" ? window.location.hash : "";
  const sources = [search, liveSearch, liveHash.replace(/^#/, "?"), INITIAL_SEARCH, INITIAL_HASH.replace(/^#/, "?")].filter(Boolean) as string[];
  const merged = new URLSearchParams();
  for (const source of sources) {
    const params = new URLSearchParams(source.startsWith("?") ? source : `?${source}`);
    params.forEach((value, key) => { if (!merged.has(key)) merged.set(key, value); });
  }
  return merged;
}

/** Reads a provider-side failure (`?insforge_error=...`) from the return URL. */
export function readOAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const params = paramsFromLocation();
  const err = params.get("insforge_error") ?? params.get("error");
  if (!err) return null;
  const desc = params.get("error_description") ?? params.get("insforge_error_description");
  return desc ? `${err}: ${desc}` : err;
}

/** Detects an OAuth return in the current URL (does not consume it). */
export function readOAuthCallback(search?: string): OAuthCallback | null {
  const params = paramsFromLocation(search);
  const code = params.get("insforge_code") ?? params.get("code");
  if (!code) return null;
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(readOAuthState(OAUTH_META_KEY) || "{}"); } catch { /* */ }
  return { code, provider: meta.provider ?? params.get("provider") ?? "google", meta };
}

/**
 * Exchanges the returned code + stored PKCE verifier for a session.
 *
 * Hardened for Apple: the same code can be delivered twice (StrictMode remount,
 * bfcache restore, form_post replay) and the verifier can be missing when the
 * return lands in a fresh browsing context. Both cases used to surface as
 * "auth failed" on some phones while working fine on others.
 */
const inflightExchanges = new Map<string, Promise<{ user: InsForgeUser; isNewUser?: boolean }>>();

async function exchangeOAuthCode(code: string, verifier: string | null): Promise<any> {
  const body: Record<string, string> = { code };
  if (verifier) body.code_verifier = verifier;
  const res = await fetch(`${INSFORGE_URL}/api/auth/oauth/exchange?client_type=mobile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: INSFORGE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

export function ifCompleteOAuth(code: string): Promise<{ user: InsForgeUser; isNewUser?: boolean }> {
  const existing = inflightExchanges.get(code);
  if (existing) return existing;
  const run = (async () => {
    const verifier = readOAuthState(PKCE_KEY) || null;
    let data: any = null;
    let firstError: unknown = null;

    if (verifier) {
      try { data = await exchangeOAuthCode(code, verifier); } catch (err) { firstError = err; }
    }
    // Verifier missing or rejected (lost/partitioned storage): try once without
    // it — some providers/configs complete the exchange server-side.
    if (!data) {
      try { data = await exchangeOAuthCode(code, null); } catch (err) { firstError ??= err; }
    }

    dropOAuthState(PKCE_KEY);
    dropOAuthState(OAUTH_META_KEY);

    if (data) {
      setTokens(data.accessToken ?? null, data.refreshToken ?? null);
      const user = await ensureSessionUser(data, "Provider sign-in");
      return { user, isNewUser: !!data.isNewUser };
    }

    // The exchange may already have succeeded (duplicate delivery of the same
    // code). Trust an existing session before failing the sign-in.
    const fallback = await ifGetSession().catch(() => null);
    if (fallback?.id) return { user: fallback };
    throw firstError instanceof Error
      ? firstError
      : new Error("Sign-in session expired — please try again");
  })();
  inflightExchanges.set(code, run);
  // Keep successful results cached briefly so a remount reuses them.
  void run.catch(() => { inflightExchanges.delete(code); });
  setTimeout(() => inflightExchanges.delete(code), 60_000);
  return run;
}



/** Strips OAuth params from the address bar without a navigation. */
export function clearOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let touched = false;
  for (const key of ["insforge_code", "code", "state", "insforge_status", "insforge_type", "insforge_error", "error", "error_description"]) {
    if (url.searchParams.has(key)) { url.searchParams.delete(key); touched = true; }
  }
  if (url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    for (const key of ["insforge_code", "code", "state", "insforge_status", "insforge_type", "insforge_error", "error", "error_description"]) {
      if (hashParams.has(key)) { hashParams.delete(key); touched = true; }
    }
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
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
export async function upsertUserProfile(
  row: UserProfileRow,
  opts: { writeRole?: boolean } = {},
): Promise<UserProfileRow | null> {
  const payload = cleanRow(row);
  // PATCH silently succeeds with 0 rows affected, so check existence first.
  const existing = await fetchUserProfile(row.id);
  if (existing) {
    const { id: _omit, registration_timestamp: _ts, ...patch } = payload as Record<string, unknown>;
    // NEVER rewrite the role of an existing account on a plain sign-in — a
    // transient profile read failure would otherwise demote a merchant
    // manager / partner / rider back to CUSTOMER.
    if (!opts.writeRole) delete patch.role;
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
