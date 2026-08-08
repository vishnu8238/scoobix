import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Role, User } from "./types";
import {
  ifSignup,
  ifLogin,
  ifLogout,
  ifGetSession,
  ifSendPasswordReset,
  ifVerifyEmail,
  ifResendVerificationEmail,
  ifCreateOAuthUrl,
  navigateToOAuthUrl,
  ifCompleteOAuth,
  readOAuthCallback,
  readOAuthError,
  clearOAuthParamsFromUrl,
  fetchUserProfile,
  findUserProfileByEmail,
  upsertUserProfile,
  referralCodeFor,
  type DbRole,
  type InsForgeUser,
  type OAuthProvider,
  type UserProfileRow,
} from "./insforge-auth";
import { listTable } from "./insforge-crud";
import { isPhoneOtpEnabled, sendPhoneOtp, verifyPhoneOtp, normalisePhone } from "./phone-otp";
import { setTokens } from "./insforge-auth";
import { clearLastRoute } from "./last-route";
import {
  accountUsable,
  endCurrentSession,
  fetchUserSecurity,
  heartbeatSession,
  noteFailedLogin,
  onLoginSuccess,
  recordLogin,
} from "./security-api";
import { clearElevationCache } from "./permissions";
import { rateLimit, guardMessage } from "./api-guard";
import { deviceId } from "./device-context";


/**
 * Auth store backed by InsForge Auth.
 *
 * - Email + password, Google / Apple OAuth (PKCE), and a pluggable phone-OTP layer.
 * - Session persists across refresh (access + refresh tokens), auto-refreshing
 *   expired access tokens and clearing revoked ones.
 * - The authoritative profile lives in `public.users`; every sign-in path funnels
 *   through `syncProfile` so one person always maps to ONE account row.
 * - DB roles (customer | restaurant | driver | admin) are mapped to the historical
 *   UI Role enum (customer | partner | rider | admin) so routes stay unchanged.
 */

type AuthResult = { ok: boolean; user?: User; message?: string; needsVerification?: boolean };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  /** Persisted role from the previous session; used to route before `user` resolves. */
  cachedRole: Role | null;
  /** The portal currently being used for login/authentication. */
  activePortal: Role | null;
  signIn: (email: string, password: string, role?: Role) => Promise<AuthResult>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<AuthResult>;
  signInWithProvider: (provider: OAuthProvider, role?: Role, claimRole?: boolean, forceSelect?: boolean) => Promise<{ ok: boolean; message?: string }>;
  phoneOtpEnabled: boolean;
  requestPhoneOtp: (phone: string) => Promise<{ ok: boolean; message?: string; resendAfter: number }>;
  verifyPhoneLogin: (phone: string, otp: string, role?: Role) => Promise<AuthResult>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  /** Last provider sign-in failure (Google / Apple), surfaced by the login UI. */
  oauthError: string | null;
  clearOAuthError: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  setPortal: (portal: Role | null) => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const ROLE_HOME: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
  manager: "/manager",
};

/**
 * Resolves the portal type from a URL path.
 * This is the authoritative way to determine WHICH app the user is trying to use.
 */
export function resolvePortalFromPath(path: string): Role | null {
  const p = path.toLowerCase();
  if (p.startsWith("/partner")) return "partner";
  if (p.startsWith("/rider")) return "rider";
  if (p.startsWith("/manager")) return "manager";
  if (p.startsWith("/admin")) return "admin";
  // /auth and /app are customer portal
  if (p.startsWith("/app") || p.startsWith("/auth")) return "customer";
  return null;
}

// ---------- role mapping between DB and existing UI enum ----------

const DB_TO_UI: Record<DbRole, Role> = {
  customer: "customer",
  restaurant: "partner",
  driver: "rider",
  admin: "admin",
  merchant_manager: "manager",
};
const UI_TO_DB: Record<Role, DbRole> = {
  customer: "customer",
  partner: "restaurant",
  rider: "driver",
  admin: "admin",
  manager: "merchant_manager",
};

function toUiRole(role: string | undefined | null): Role | null {
  if (!role) return null;
  const key = String(role).toLowerCase();
  if (key in DB_TO_UI) return DB_TO_UI[key as DbRole];
  if (key === "merchant_manager" || key === "manager") return "manager";
  if (["customer", "partner", "rider", "admin"].includes(key)) return key as Role;
  return null;
}

const PENDING_ROLE_KEY = "scoobix_pending_role_v1";
const PENDING_ROLE_CLAIM_KEY = "scoobix_pending_role_claim_v1";
/** Last resolved role, mirrored locally so reloads route instantly. */
const CACHED_ROLE_KEY = "scoobix_role_v1";

const ALL_ROLES: Role[] = ["customer", "partner", "rider", "admin", "manager"];

export function readCachedRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(CACHED_ROLE_KEY) as Role | null;
    return value && ALL_ROLES.includes(value) ? value : null;
  } catch { return null; }
}

function writeCachedRole(role: Role | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) localStorage.setItem(CACHED_ROLE_KEY, role);
    else localStorage.removeItem(CACHED_ROLE_KEY);
  } catch { /* */ }
}



function rememberPendingRole(role?: Role, claim = false) {
  console.log(`[auth] Remembering pending role: ${role} (claim: ${claim})`);
  try {
    if (role) sessionStorage.setItem(PENDING_ROLE_KEY, role);
    if (role && claim) sessionStorage.setItem(PENDING_ROLE_CLAIM_KEY, "1");
  } catch { /* */ }
  try {
    if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
    if (role && claim) localStorage.setItem(PENDING_ROLE_CLAIM_KEY, "1");
  } catch { /* */ }
}

function takePendingRole(): { role?: Role; claim: boolean } {
  try {
    const value = (sessionStorage.getItem(PENDING_ROLE_KEY) ?? localStorage.getItem(PENDING_ROLE_KEY)) as Role | null;
    const claim =
      (sessionStorage.getItem(PENDING_ROLE_CLAIM_KEY) ?? localStorage.getItem(PENDING_ROLE_CLAIM_KEY)) === "1";
    console.log(`[auth] Taking pending role: ${value} (claim: ${claim})`);
    sessionStorage.removeItem(PENDING_ROLE_KEY);
    localStorage.removeItem(PENDING_ROLE_KEY);
    sessionStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
    localStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
    return { role: value ?? undefined, claim };
  } catch { return { claim: false }; }
}



function mergeProviders(existing: string | null | undefined, provider: string): string {
  const list = new Set((existing ?? "").split(",").map((p) => p.trim()).filter(Boolean));
  list.add(provider);
  return Array.from(list).join(",");
}

type SyncInput = {
  role?: Role;
  /** Signup paths claim the chosen role even if a default profile row exists. */
  forceRole?: boolean;
  name?: string;
  phone?: string;
  provider?: string;
};

/**
 * THE single authentication pipeline. Every path (email login, email signup,
 * Google, Apple, phone OTP, session restore) funnels through here.
 *
 * Guarantees:
 * - returns null instead of throwing when there is no session user,
 * - always ensures exactly one `public.users` row for the auth account
 *   (self-healing for accounts created before the profile write worked),
 * - never reads a property off a profile that may not exist.
 */
async function syncProfile(sess: InsForgeUser | null | undefined, input: SyncInput = {}, requestedPortal?: Role): Promise<User | null> {
  console.log("[auth] Syncing profile for session user:", sess?.id, "with input:", JSON.stringify(input));
  if (!sess || typeof sess.id !== "string" || !sess.id) return null;


  const provider = input.provider ?? "email";
  let existing: UserProfileRow | null = null;
  try {
    existing =
      (await fetchUserProfile(sess.id)) ?? (sess.email ? await findUserProfileByEmail(sess.email) : null);
  } catch {
    existing = null;
  }
  // The same email can own several independent accounts (one per app). Only the
  // row that belongs to THIS auth account may dictate the role — otherwise an
  // older CUSTOMER row for the same address drags every new account (admin,
  // partner, rider…) back into the customer app.
  const ownRow = existing && existing.id === sess.id ? existing : null;

  const name =
    existing?.name ||
    input.name ||
    (sess.profile?.name as string | undefined) ||
    (sess.profile?.full_name as string | undefined) ||
    ((sess.metadata?.name ?? sess.metadata?.full_name) as string | undefined) ||
    (sess.email ? sess.email.split("@")[0] : provider === "apple" ? "Apple User" : "User");
  const avatar =
    (sess.profile?.avatar_url as string | undefined) || existing?.avatar || undefined;
  // On signup the user explicitly picks their app, so that choice overrides the
  // default profile row the backend may have already created as CUSTOMER.
  const existingRole = toUiRole(ownRow?.role);
  const phone = existing?.phone || input.phone || "";
  // Apple can withhold the address entirely — never write an empty string into
  // a unique column, and never crash on the missing value.
  const email = sess.email || existing?.email || "";
  // The admin role can never be claimed from a form — only the backend
  // allow list grants it (checked after the profile write below).
  const requested =
    input.role === "admin" && !(await userIsPlatformAdmin(sess.id, email)) ? undefined : input.role;
  const role =
    (input.forceRole ? requested : undefined) ?? existingRole ?? requested ?? "customer";


  const row: UserProfileRow = {
    id: sess.id,
    email: email || null,
    name,
    phone: phone || null,
    role: UI_TO_DB[role],
    avatar: avatar ?? null,
    status: existing?.status ?? "active",
    provider,
    providers: mergeProviders(existing?.providers, provider),
    email_verified: sess.emailVerified ?? existing?.email_verified ?? false,
    last_login_at: new Date().toISOString(),
    referral_code: existing?.referral_code || referralCodeFor(sess.id, name),
    wallet_balance: existing?.wallet_balance ?? 0,
    loyalty_points: existing?.loyalty_points ?? 0,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(sess.metadata ?? {}),
      last_provider: provider,
      updated_at: new Date().toISOString(),
    },
  };

  // Email uniqueness check to prevent duplicates.
  if (!ownRow && row.email) {
    const conflict = await findUserProfileByEmail(row.email).catch(() => null);
    if (conflict && conflict.id !== sess.id) {
       // A profile for this email already exists under a different auth ID.
       // Redirect to login or merge if appropriate, but do NOT overwrite or duplicate.
       console.warn("[auth] Email conflict detected in profile sync", row.email);
       return {
         id: conflict.id,
         name: conflict.name || name,
         email: conflict.email || row.email,
         phone: conflict.phone || row.phone || "",
         role: toUiRole(conflict.role) ?? "customer",
         avatar: conflict.avatar || avatar,
       };
    }
  }

  // Blocking: the profile must exist before the UI ever sees the user.
  const saved = await upsertUserProfile(row, { writeRole: input.forceRole || !ownRow }).catch(() => null);
  let finalRole = input.forceRole ? role : toUiRole(saved?.role) ?? role;

  // Safety net: a provisioned merchant manager must always land in /manager,
  // even if their profile row was created (or reset) as CUSTOMER.
  if (!input.forceRole && finalRole === "customer") {
    const isManager = await userIsMerchantManager(sess.id);
    if (isManager) {
      finalRole = "manager";
      await upsertUserProfile({ id: sess.id, role: UI_TO_DB.manager }, { writeRole: true }).catch(() => null);
    }
  }

  // Same safety net for platform operators: an allow-listed account always
  // resolves to /admin, whatever its profile row currently says.
  if (finalRole !== "admin" && (await userIsPlatformAdmin(sess.id, email))) {
    finalRole = "admin";
    await upsertUserProfile({ id: sess.id, role: UI_TO_DB.admin }, { writeRole: true }).catch(() => null);
  }

  return {
    id: sess.id,
    name: saved?.name || name,
    email: saved?.email || email,
    phone: saved?.phone || phone,
    role: finalRole,
    avatar: saved?.avatar || avatar,
  };
}

/** True when this auth account owns an active merchant_managers record. */
async function userIsMerchantManager(userId: string): Promise<boolean> {
  try {
    const rows = await listTable<{ id: string }>("merchant_managers", {
      user_id: `eq.${userId}`,
      select: "id",
      limit: 1,
    });
    return !!rows[0]?.id;
  } catch {
    return false;
  }
}

/**
 * True when the account is on the platform-admin allow list (`platform_admins`),
 * matched by auth id or by email. Admin access is granted from the backend only
 * — never from the login form or from local storage.
 */
async function userIsPlatformAdmin(userId: string, email: string): Promise<boolean> {
  const hit = async (params: Record<string, string | number>) => {
    try {
      const rows = await listTable<{ id: string; status?: string }>("platform_admins", {
        select: "id,status",
        limit: 1,
        ...params,
      });
      const row = rows[0];
      return !!row?.id && (row.status ?? "active") !== "disabled";
    } catch {
      return false;
    }
  };
  if (await hit({ user_id: `eq.${userId}` })) return true;
  if (email && (await hit({ email: `eq.${email.toLowerCase()}` }))) return true;
  return false;
}



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [cachedRole, setCachedRole] = useState<Role | null>(() => readCachedRole());
  const [activePortal, setActivePortalState] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);


  const setPortal = useCallback((portal: Role | null) => {
    setActivePortalState(portal);
    if (portal) {
      try {
        localStorage.setItem("scoobix_active_portal_v1", portal);
        console.log(`[auth] Portal set to: ${portal}`);
      } catch { /* */ }
    } else {
      try {
        localStorage.removeItem("scoobix_active_portal_v1");
        console.log(`[auth] Portal cleared`);
      } catch { /* */ }
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scoobix_active_portal_v1") as Role | null;
      if (stored && ALL_ROLES.includes(stored)) {
        setActivePortalState(stored);
        console.log(`[auth] Restored portal from storage: ${stored}`);
      }
    } catch { /* */ }
  }, []);


  /**
   * Every session update also mirrors the resolved role to local storage, so a
   * refresh or cold app start can route to the right surface.
   */
  const setUser = useCallback((next: User | null) => {
    console.log("[auth] setUser state update:", next?.id, next?.role);
    setUserState(next);
    
    // We update the cache to persist the role, but it must NEVER be used to
    // authorize authentication or portal navigation.
    if (next) {
      writeCachedRole(next.role);
      setCachedRole(next.role);
    } else {
      writeCachedRole(null);
      setCachedRole(null);
    }
  }, []);




  // Auto-login + OAuth return handling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let handledOAuth = false;
      try {
        console.log("[auth] BOOT: Starting authentication flow...");
        const providerError = readOAuthError();
        if (providerError) {
          console.error("[auth] OAuth provider returned an error", providerError);
          if (!cancelled) setOauthError(providerError);
          clearOAuthParamsFromUrl();
        }
        const callback = readOAuthCallback();
        if (callback) {
          console.log("[auth] OAuth callback detected", callback.provider);
          try {
            const { user: sess } = await ifCompleteOAuth(callback.code);
            console.log("[auth] OAuth code exchanged for session:", sess?.id);
            const pending = takePendingRole();
            const next = await syncProfile(sess, {
              provider: String(callback.provider),
              role: pending.role ?? activePortal ?? undefined,
              forceRole: pending.claim || !!activePortal,
            });
            if (!cancelled && next) {
              console.log("[auth] Profile synced for OAuth user:", next.id, next.role);
              const blocked = await admitSession(next, String(callback.provider));
              if (blocked) {
                console.warn("[auth] Session admission blocked:", blocked);
                setOauthError(blocked);
              } else {
                console.log("[auth] Session admitted, setting user state.");
                setUser(next);
                handledOAuth = true;
                try {
                  window.opener?.postMessage({ type: "scoobix_oauth_complete" }, window.location.origin);
                  if (window.opener && !window.opener.closed) window.setTimeout(() => window.close(), 250);
                } catch { /* */ }
              }
            }

          } catch (err) {
            console.error("[auth] OAuth callback failed", err);
            if (!cancelled) {
              setOauthError(err instanceof Error ? err.message : "Provider sign-in failed");
            }
          }
          clearOAuthParamsFromUrl();
        }
        if (handledOAuth) return;
        const sess = await ifGetSession();
        console.log("[auth] INITIAL_SESSION check:", sess ? "FOUND" : "NONE", sess?.id);
        if (cancelled) return;
        if (sess) {
          const next = await syncProfile(sess, { role: activePortal ?? undefined, forceRole: !!activePortal });
          console.log("[auth] Profile restored for session user:", next?.id, next?.role);
          if (!cancelled && next) setUser(next);
        } else if (!callback) {
          console.log("[auth] No active session, user is UNAUTHENTICATED.");
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          console.log("[auth] Auth boot complete, loading = false.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activePortal]);


  useEffect(() => {
    let cancelled = false;
    const restoreFromSharedSession = async () => {
      const sess = await ifGetSession();
      if (cancelled) return;
      const next = await syncProfile(sess);
      if (!cancelled && next) setUser(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith("scoobix_if_")) void restoreFromSharedSession();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "scoobix_oauth_complete") {
        void restoreFromSharedSession();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // Keep the active-session row warm so admin "active sessions" is truthful and
  // abandoned sessions age out on their own.
  useEffect(() => {
    if (!user?.id) return;
    void heartbeatSession();
    const timer = window.setInterval(() => void heartbeatSession(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);



  /**
   * Post-authentication security gate. Blocks locked / suspended / deleted
   * accounts, then opens the session row, device record and audit entries.
   * Returns an error message when the account may not be used.
   */
  const admitSession = useCallback(async (next: User, provider: string): Promise<string | null> => {
    const security = await fetchUserSecurity(next.id).catch(() => null);
    const verdict = accountUsable(security);
    if (!verdict.ok) {
      await recordLogin({
        userId: next.id, email: next.email, role: next.role,
        event: "locked", provider, success: false, reason: verdict.state,
      }).catch(() => null);
      setTokens(null, null);
      void ifLogout();
      return verdict.reason ?? "This account cannot be used right now.";
    }

    // Role-based Authorization check against requested portal
    // If the user is logging in at a specific portal, their role MUST match.
    // We retrieve the active portal from the URL or state.
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    const requestedPortal = resolvePortalFromPath(currentPath);
    
    if (requestedPortal && next.role !== requestedPortal) {
       // We DO NOT block the session admission here, because the Login page 
       // needs the 'user' object to show the "Wrong Account" UI.
       // However, we record it for security.
       console.warn(`[auth] Portal mismatch: user is ${next.role}, requested ${requestedPortal}`);
    }

    void onLoginSuccess({ userId: next.id, email: next.email, role: next.role, provider });
    return null;
  }, []);


  const signIn: AuthCtx["signIn"] = async (address, password, role) => {
    try {
      rateLimit("auth.login", `${deviceId()}:${address.toLowerCase()}`);
    } catch (err) {
      return { ok: false, message: guardMessage(err) };
    }

    try {
      const { user: sess } = await ifLogin(address, password);
      const next = await syncProfile(sess, { provider: "email", role: role ?? activePortal ?? undefined, forceRole: !!(role || activePortal) });
      if (!next) return { ok: false, message: "Could not load your account" };

      const blocked = await admitSession(next, "email");
      if (blocked) return { ok: false, message: blocked };

      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      console.error("[auth] Email sign-in failed", message);
      void (async () => {
        const existing = await findUserProfileByEmail(address).catch(() => null);
        await noteFailedLogin(address, existing?.id ?? null).catch(() => null);
      })();
      return { ok: false, message, needsVerification: /verif/i.test(message) };
    }
  };


  const signUp: AuthCtx["signUp"] = async ({ name, email, phone, password, role }) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      const { user: sess, requireEmailVerification } = await ifSignup(email.trim(), password, name.trim(), redirectTo);
      // Profile creation is attempted for every signup; when verification is
      // pending there may be no session user yet — the row is then created on
      // the first successful login (self-healing).
      const next = await syncProfile(sess, { provider: "email", role, forceRole: true, name: name.trim(), phone });
      if (requireEmailVerification) {
        return {
          ok: true,
          needsVerification: true,
          message: "Check your email to verify your account before signing in.",
        };
      }
      if (!next) return { ok: false, message: "Account created but sign-in failed. Please sign in." };
      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      console.error("[auth] Email sign-up failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Sign up failed" };
    }
  };


  const signInWithProvider: AuthCtx["signInWithProvider"] = async (provider, role, claimRole = false, forceSelect = false) => {
    try {
      setOauthError(null);
      rememberPendingRole(role, claimRole);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const queryParams: Record<string, string> = {};
      if (forceSelect) {
        if (provider === "google") {
          queryParams.prompt = "select_account";
        } else if (provider === "apple") {
          // Apple doesn't have a direct 'select_account' equivalent via standard query params in many InsForge setups,
          // but often passing a new nonce or state forces re-auth. Standard is prompt=login or similar if supported.
          queryParams.prompt = "login";
        }
      }
      const authUrl = await ifCreateOAuthUrl(provider, redirectUri, undefined, queryParams);
      navigateToOAuthUrl(authUrl);
      return { ok: true };
    } catch (err) {
      console.error(`[auth] ${provider} sign-in failed`, err);
      return { ok: false, message: err instanceof Error ? err.message : `Could not sign in with ${provider}` };
    }
  };

  const requestPhoneOtp: AuthCtx["requestPhoneOtp"] = async (phone) => {
    const res = await sendPhoneOtp(phone);
    return { ok: res.ok, message: res.message, resendAfter: res.resendAfter };
  };

  const verifyPhoneLogin: AuthCtx["verifyPhoneLogin"] = async (phone, otp, role) => {
    try {
      rateLimit("auth.otp", `${deviceId()}:${normalisePhone(phone)}`);
    } catch (err) {
      return { ok: false, message: guardMessage(err) };
    }
    const res = await verifyPhoneOtp(phone, otp);
    if (!res.ok || !res.accessToken) return { ok: false, message: res.message ?? "Invalid code" };
    setTokens(res.accessToken, res.refreshToken ?? null);
    const sess = await ifGetSession();
    if (!sess) return { ok: false, message: "Could not start a session" };
    const next = await syncProfile(sess, { provider: "phone", role: role ?? activePortal ?? undefined, forceRole: !!(role || activePortal), phone: normalisePhone(phone) });
    if (!next) return { ok: false, message: "Could not load your account. Please try again." };
    const blocked = await admitSession(next, "phone");
    if (blocked) return { ok: false, message: blocked };
    setUser(next);
    return { ok: true, user: next };
  };


  const verifyEmailCode: AuthCtx["verifyEmailCode"] = async (email, code) => {
    try {
      const sess = await ifVerifyEmail(email.trim(), code.trim());
      if (!sess) return { ok: false, message: "Verification failed" };
      const next = await syncProfile(sess, { provider: "email" });
      if (!next) return { ok: false, message: "Could not load your account. Please try again." };
      setUser(next);
      return { ok: true, user: next };

    } catch (err) {
      console.error("[auth] Email verification failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Verification failed" };
    }
  };

  const resendVerification: AuthCtx["resendVerification"] = async (email) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      await ifResendVerificationEmail(email.trim(), redirectTo);
      return { ok: true, message: "Verification email sent" };
    } catch (err) {
      console.error("[auth] Verification resend failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Could not resend email" };
    }
  };

  const signOut = useCallback(async () => {
    const signingOut = user?.id ?? null;
    console.log("[auth] SIGN_OUT started for user:", signingOut);
    try {
      if (signingOut) {
        await heartbeatSession().catch(() => null);
        await endCurrentSession(signingOut).catch(() => {});
        clearElevationCache(signingOut);
      }
      await ifLogout();
      console.log("[auth] InsForge logout complete.");
    } catch (err) {
      console.error("[auth] InsForge logout error:", err);
    } finally {
      console.log("[auth] Clearing local session tokens and state.");
      setTokens(null, null);
      clearLastRoute();
      
      // Atomic storage removal
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(CACHED_ROLE_KEY);
          localStorage.removeItem("scoobix_active_portal_v1");
          localStorage.removeItem(PENDING_ROLE_KEY);
          localStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
          sessionStorage.removeItem(PENDING_ROLE_KEY);
          sessionStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
          
          // Also clear security-api local session if any
          localStorage.removeItem("scoobix.security.session_row");
        } catch { /* */ }
      }
      
      setCachedRole(null);
      setUser(null);
      void import("./realtime-bus").then((m) => m.disconnectRealtime()).catch(() => {});
      console.log("[auth] SIGN_OUT finished.");
    }
  }, [user?.id, setUser]);




  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      await ifSendPasswordReset(email.trim(), redirectTo);
      return { ok: true, message: "Reset link sent — check your inbox" };
    } catch (err) {
      console.error("[auth] Password reset failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Could not send reset email" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        cachedRole,
        activePortal,
        signIn,
        signUp,
        signInWithProvider,
        oauthError,
        clearOAuthError: () => setOauthError(null),
        phoneOtpEnabled: isPhoneOtpEnabled(),
        requestPhoneOtp,
        verifyPhoneLogin,
        verifyEmailCode,
        resendVerification,
        signOut,
        resetPassword,
        setPortal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
