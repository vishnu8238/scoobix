// [AUTH_FORENSIC] IDENTITY SYNC & PORTAL ROUTING AUDIT
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
  getAccessToken,
  setTokens,
  type DbRole,
  type InsForgeUser,
  type OAuthProvider,
  type UserProfileRow,
} from "./insforge-auth";
import { listTable } from "./insforge-crud";
import { isPhoneOtpEnabled, sendPhoneOtp, verifyPhoneOtp, normalisePhone } from "./phone-otp";
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
  /** All roles available to the current user. */
  roles: Role[];
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
  authBootTimeout: boolean;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const ROLE_HOME: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
  manager: "/manager",
};

/** Portal-specific onboarding routes for users who intend to enter a portal but lack membership. */
export const ROLE_ONBOARDING: Record<Role, string> = {
  customer: "/app",
  partner: "/partner/onboarding",
  rider: "/rider/onboarding",
  admin: "/admin",
  manager: "/manager/onboarding",
};

/**
 * Resolves the portal type from a URL path and/or search parameters.
 * This is the EXPLICIT URL PORTAL INTENT / CURRENT PORTAL PATH source of truth.
 */
export function getPortalIntent(pathname: string, search?: string | URLSearchParams): Role | null {
  // 1. Explicit search param ?app=
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const appParam = params?.get("app");
  if (appParam && ALL_ROLES.includes(appParam as Role)) return appParam as Role;
  
  // 2. Path-based detection
  return resolvePortalFromPath(pathname);
}

/**
 * Resolves all application roles a user belongs to based on membership tables.
 */
export async function resolveUserMemberships(userId: string, email: string) {
  const [isDriver, isManager, isAdmin, ownedRestaurants, managedRestaurants] = await Promise.all([
    listTable<{ id: string }>("drivers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).then(rows => !!rows[0]?.id).catch(() => false),
    userIsMerchantManager(userId),
    userIsPlatformAdmin(userId, email),
    listTable<{ id: string }>("restaurants", { owner_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("restaurants", { manager_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => [])
  ]);

  return {
    customer: true, // Everyone is a customer
    rider: isDriver,
    manager: isManager,
    admin: isAdmin,
    partner: ownedRestaurants.length > 0 || managedRestaurants.length > 0
  };
}

/**
 * Resolves the destination for an authenticated user based on their memberships and portal intent.
 * This is the SINGLE SOURCE OF TRUTH for post-authentication routing.
 */
export function resolveAuthenticatedDestination(user: User, intent: Role | null): string {
  // Priority: 
  // 1. Intent (Explicit URL Portal)
  // 2. Authenticated Membership matching that intent
  // 3. Default to highest staff role or Customer if no membership or no intent
  
  const portal = intent || null;
  
  if (portal) {
    if (user.roles.includes(portal)) {
      return ROLE_HOME[portal];
    } else if (portal !== "customer") {
      // Authenticated but no membership -> Onboarding for THAT portal
      return ROLE_ONBOARDING[portal];
    }
  }
  
  // No specific intent or unauthorized for intent: resolve from memberships
  if (user.roles.includes("admin")) return ROLE_HOME.admin;
  if (user.roles.includes("manager")) return ROLE_HOME.manager;
  if (user.roles.includes("partner")) return ROLE_HOME.partner;
  if (user.roles.includes("rider")) return ROLE_HOME.rider;
  
  return "/app";
}

/**
 * Resolves the portal type from a URL path.
 */
export function resolvePortalFromPath(path: string): Role | null {
  const p = path.toLowerCase();
  
  // Check for exact login patterns first to avoid ambiguity
  if (p.includes("/partner/login") || p.includes("/merchant/login")) return "partner";
  if (p.includes("/rider/login")) return "rider";
  if (p.includes("/manager/login")) return "manager";
  if (p.includes("/admin/login")) return "admin";

  if (p.startsWith("/partner") || p.startsWith("/merchant")) return "partner";
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
 * Resolves all application roles a user belongs to based on membership tables.
 */
async function resolveUserRoles(userId: string, email: string): Promise<Role[]> {
  const memberships = await resolveUserMemberships(userId, email);
  const roles: Role[] = [];
  if (memberships.customer) roles.push("customer");
  if (memberships.rider) roles.push("rider");
  if (memberships.manager) roles.push("manager");
  if (memberships.partner) roles.push("partner");
  if (memberships.admin) roles.push("admin");
  return roles;
}

/**
 * THE single authentication pipeline. Every path (email login, email signup,
 * Google, Apple, phone OTP, session restore) funnels through here.
 *
 * It resolves all authorized roles and establishes the current session role
 * based on the requested portal, WITHOUT overwriting the DB role column.
 */
async function syncProfile(sess: InsForgeUser | null | undefined, input: SyncInput = {}, requestedPortal?: Role): Promise<User | null> {
  const meta = {
    pathname: typeof window !== "undefined" ? window.location.pathname : "",
    requestedPortal: requestedPortal || input.role || "none",
    sessionId: sess?.id || "none",
    hasSession: !!sess,
    hasAccessToken: !!getAccessToken(),
  };
  console.log("[AUTH_FORENSIC] syncProfile starting:", meta);
  
  if (!sess || typeof sess.id !== "string" || !sess.id) {
    console.warn("[AUTH_FORENSIC] syncProfile: No valid session user id.");
    return null;
  }

  const provider = input.provider ?? "email";
  let existing: UserProfileRow | null = null;
  try {
    // Authority: Auth UUID (sess.id).
    existing = await fetchUserProfile(sess.id);
  } catch {
    existing = null;
  }
  const ownRow = existing;

  const name =
    existing?.name ||
    input.name ||
    (sess.profile?.name as string | undefined) ||
    (sess.profile?.full_name as string | undefined) ||
    ((sess.metadata?.name ?? sess.metadata?.full_name) as string | undefined) ||
    (sess.email ? sess.email.split("@")[0] : provider === "apple" ? "Apple User" : "User");
  
  const avatar = (sess.profile?.avatar_url as string | undefined) || existing?.avatar || undefined;
  const phone = existing?.phone || input.phone || "";
  const email = (sess.email || existing?.email || "").toLowerCase();

  // 1. Resolve ALL roles from authoritative membership sources.
  const allRoles = await resolveUserRoles(sess.id, email);
  console.log("[AUTH_FORENSIC] syncProfile resolved roles:", allRoles);
  
  // 2. Determine the session's active role. 
  // Priority: 
  // 1. requestedPortal (explicit context from URL/parameter)
  // 2. target (from sign-in input)
  // 3. Highest existing role from allRoles
  // 4. 'customer'
  let sessionRole: Role = "customer";
  
  // Hardened Requested Portal Resolution
  const target = requestedPortal || input.role;
  
  // PRIORITIZE the target (requested portal). 
  // If the user lacks membership, we still treat them as entering that portal 
  // (the UI will handle onboarding redirection).
  if (target) {
    sessionRole = target as Role;
    console.log(`[auth] Using explicitly requested portal: ${sessionRole}`);
  } else if (allRoles.includes("admin")) {
    sessionRole = "admin";
  } else if (allRoles.includes("manager")) {
    sessionRole = "manager";
  } else if (allRoles.includes("partner")) {
    sessionRole = "partner";
  } else if (allRoles.includes("rider")) {
    sessionRole = "rider";
  } else {
    sessionRole = "customer";
  }

  console.log(`[AUTH_FORENSIC] syncProfile session role finalized: ${sessionRole} (requested: ${requestedPortal}, target: ${input.role}, all: ${allRoles.join(",")})`);

  // 3. Ensure user profile exists in database.
  // We NO LONGER overwrite the role column with requestedPortal if it exists.
  const dbRoleValue = ownRow?.role ? ownRow.role : UI_TO_DB[sessionRole];
  
  const row: UserProfileRow = {
    id: sess.id,
    email: email || null,
    name,
    phone: phone || null,
    role: dbRoleValue,
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

  // Only write role for brand new profiles. NEVER overwrite an existing user's role 
  // column merely because they are entering a different portal.
  const saved = await upsertUserProfile(row, { writeRole: !ownRow }).catch(() => null);

  return {
    id: sess.id,
    name: saved?.name || name,
    email: saved?.email || email,
    phone: saved?.phone || phone,
    role: sessionRole,
    roles: allRoles,
    avatar: saved?.avatar || avatar,
  };
}

/** True when this auth account owns an active merchant_managers record or manages restaurants. */
async function userIsMerchantManager(userId: string): Promise<boolean> {
  try {
    const [managerRows, restaurantRows] = await Promise.all([
      listTable<{ id: string }>("merchant_managers", {
        user_id: `eq.${userId}`,
        select: "id",
        limit: 1,
      }),
      listTable<{ id: string }>("restaurants", {
        manager_id: `eq.${userId}`,
        select: "id",
        limit: 1,
      })
    ]);
    return !!managerRows[0]?.id || !!restaurantRows[0]?.id;
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
  const [authStatus, setAuthStatus] = useState<"BOOTING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "AUTH_ERROR">("BOOTING");
  const [authBootTimeout, setAuthBootTimeout] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const setPortal = useCallback((portal: Role | null) => {
    setActivePortalState(portal);
    if (portal) {
      console.log(`[AUTH_FORENSIC] Tab portal intent updated: ${portal}`);
    }
  }, []);

  useEffect(() => {
    // Sync portal state with path on navigation
    const portal = resolvePortalFromPath(window.location.pathname);
    if (portal && portal !== activePortal) {
      setActivePortalState(portal);
    }
  }, [activePortal]);


  /**
   * Every session update also mirrors the resolved role to local storage, so a
   * refresh or cold app start can route to the right surface.
   */
  const setUser = useCallback((next: User | null) => {
    console.log("[AUTH_FORENSIC] setUser state update:", { 
      id: next?.id, 
      role: next?.role, 
      memberships: next?.roles,
      portalIntent: getPortalIntent(window.location.pathname, window.location.search)
    });
    setUserState(next);
    setAuthStatus(next ? "AUTHENTICATED" : "UNAUTHENTICATED");
    
    if (next) {
      // Mirrored locally for secondary UI hints (e.g. icon colors), but NOT authoritative for routing.
      writeCachedRole(next.role);
      setCachedRole(next.role);
    } else {
      console.log("[auth] setUser(null) - clearing session state");
      
      const hasTokens = !!localStorage.getItem("scoobix_if_access_v1");
      if (loading && hasTokens) {
        console.log("[auth] setUser(null) ignored during boot while tokens exist");
        return;
      }

      writeCachedRole(null);
      setCachedRole(null);
      try {
        localStorage.removeItem(CACHED_ROLE_KEY);
        localStorage.removeItem("scoobix_active_portal_v1");
        localStorage.removeItem(PENDING_ROLE_KEY);
        localStorage.removeItem("scoobix_if_access_v1");
        localStorage.removeItem("scoobix_if_refresh_v1");
        sessionStorage.removeItem(PENDING_ROLE_KEY);
        sessionStorage.removeItem("scoobix_active_portal_v1");
        
        // Clear all cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      } catch { /* ignore */ }
    }
  }, [loading]);




  // Auto-login + OAuth return handling.
  useEffect(() => {
    let cancelled = false;
    
    // Safety timeout to prevent infinite loading screens
    const timeout = setTimeout(() => {
      if (loading && !cancelled) {
        console.error("[auth] BOOT: Auth resolution timed out after 8s");
        setAuthBootTimeout(true);
        setLoading(false);
      }
    }, 8000);

    (async () => {
      try {
        console.log("[AUTH_FORENSIC] BOOT: Starting authentication flow. URL:", window.location.href);
        const providerError = readOAuthError();
        if (providerError) {
          console.error("[AUTH_FORENSIC] BOOT: OAuth provider returned an error", providerError);
          if (!cancelled) {
            setOauthError(providerError);
            setAuthStatus("AUTH_ERROR");
          }
          clearOAuthParamsFromUrl();
        }

        const callback = readOAuthCallback();
        const currentPortal = getPortalIntent(window.location.pathname, window.location.search);
        console.log("[AUTH_FORENSIC] BOOT: Portal intent resolved from URL:", currentPortal);

        if (callback) {
          console.log("[auth] BOOT: OAuth callback detected", callback.provider);
          try {
            const { user: sess } = await ifCompleteOAuth(callback.code);
            const pending = takePendingRole();
            
            // Priority: pending.role (stashed) -> currentPortal (URL intent)
            const targetPortal = pending.role ?? currentPortal ?? undefined;
            
            const next = await syncProfile(sess, {
              provider: String(callback.provider),
              role: targetPortal,
              forceRole: !!targetPortal,
            }, targetPortal);
            
            if (!cancelled && next) {
              console.log("[AUTH_FORENSIC] BOOT: Profile synced for OAuth user. Resolved destination:", resolveAuthenticatedDestination(next, targetPortal || null));
              const blocked = await admitSession(next, String(callback.provider));
              if (blocked) {
                setOauthError(blocked);
              } else {
                setUser(next);
              }
            }
          } catch (err) {
            console.error("[auth] BOOT: OAuth callback failed", err);
            if (!cancelled) {
              setOauthError(err instanceof Error ? err.message : "Provider sign-in failed");
            }
          }
          clearOAuthParamsFromUrl();
        } else {
          // Restore existing session
          const sess = await ifGetSession();
          
          if (!cancelled) {
            if (sess) {
              // Restore using URL intent
              console.log("[AUTH_FORENSIC] BOOT: Session found. Restoring profile with intent:", currentPortal);
              const next = await syncProfile(sess, {}, currentPortal ?? undefined);
              if (!cancelled && next) {
                console.log("[AUTH_FORENSIC] BOOT: Session restored. Destination:", resolveAuthenticatedDestination(next, currentPortal || null));
                setUser(next);
              }
            } else {
              const hasTokens = !!localStorage.getItem("scoobix_if_access_v1");
              if (!cancelled && !hasTokens) {
                setUser(null);
              }
            }
          }
        }
      } catch (err) {
        console.error("[auth] Global BOOT error:", err);
      } finally {
        if (!cancelled) {
          console.log("[AUTH_FORENSIC] BOOT: Auth boot complete. authStatus:", authStatus);
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    })();

    return () => { 
      cancelled = true; 
      clearTimeout(timeout);
    };
  }, [setUser]);



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
    
    if (requestedPortal && !next.roles.includes(requestedPortal as Role)) {
       // We DO NOT block the session admission here, because the Login page 
       // needs the 'user' object to show the "Access Restricted" UI.
       // However, we record it for security.
       console.warn(`[auth] Portal mismatch: user roles [${next.roles.join(",")}], requested ${requestedPortal}`);
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
      console.log(`[AUTH_FORENSIC] signIn attempt for ${address} (requested portal: ${role})`);
      const { user: sess, accessToken } = await ifLogin(address, password);
      
      // Ensure tokens are persisted and verified before proceeding
      const verify = localStorage.getItem("scoobix_if_access_v1");
      if (verify !== accessToken) {
        console.error("[auth] Token persistence verification failed in signIn");
        // We do NOT logout yet, as we might have just received them in memory.
        // But we must ensure the storage is working for the AuthProvider.
      }

      const currentPortal = getPortalIntent(window.location.pathname, window.location.search);
      const targetPortal = (role && ALL_ROLES.includes(role)) ? role : (currentPortal && ALL_ROLES.includes(currentPortal)) ? currentPortal : undefined;
      
      console.log(`[AUTH_FORENSIC] signIn: Resolving profile for target portal: ${targetPortal}`);
      const next = await syncProfile(sess, { 
        provider: "email", 
        role: targetPortal, 
        forceRole: !!targetPortal 
      }, targetPortal);

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
      const currentPortal = getPortalIntent(window.location.pathname, window.location.search);
      const targetPortal = (role && ALL_ROLES.includes(role)) ? role : (currentPortal && ALL_ROLES.includes(currentPortal)) ? currentPortal : undefined;
      const next = await syncProfile(sess, { 
        provider: "email", 
        role: targetPortal, 
        forceRole: true, 
        name: name.trim(), 
        phone 
      }, targetPortal);

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
      const currentPortal = getPortalIntent(window.location.pathname, window.location.search);
      const targetPortal = (role && ALL_ROLES.includes(role)) ? role : (currentPortal && ALL_ROLES.includes(currentPortal)) ? currentPortal : undefined;
      console.log(`[AUTH_FORENSIC] signInWithProvider: Starting OAuth. Portal intent preserved: ${targetPortal}`);
      rememberPendingRole(targetPortal, claimRole);
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
    const currentPortal = resolvePortalFromPath(window.location.pathname);
    const targetPortal = (role && ALL_ROLES.includes(role)) ? role : (currentPortal && ALL_ROLES.includes(currentPortal)) ? currentPortal : undefined;
    const next = await syncProfile(sess, { 
      provider: "phone", 
      role: targetPortal, 
      forceRole: !!targetPortal, 
      phone: normalisePhone(phone) 
    }, targetPortal);

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
      
      // Atomic storage removal for all portals and auth persistence
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(CACHED_ROLE_KEY);
          localStorage.removeItem("scoobix_active_portal_v1");
          localStorage.removeItem(PENDING_ROLE_KEY);
          localStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
          sessionStorage.removeItem(PENDING_ROLE_KEY);
          sessionStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
          
          // Clear security-api local session if any
          localStorage.removeItem("scoobix.security.session_row");
          
          // Clear any cookies that might leak context
          const cookies = document.cookie.split(";");
          for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        } catch { /* */ }
      }
      
      setActivePortalState(null);
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
        roles: user?.roles || [],
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
        authBootTimeout,
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
