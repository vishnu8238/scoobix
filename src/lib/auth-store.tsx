// [AUTH_FORENSIC] IDENTITY SYNC & PORTAL ROUTING ENGINE
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
  upsertUserProfile,
  referralCodeFor,
  type InsForgeUser,
  type OAuthProvider,
  type UserProfileRow,
} from "./insforge-auth";
import { listTable } from "./insforge-crud";
import { isPhoneOtpEnabled, sendPhoneOtp as ifSendPhoneOtp, verifyPhoneOtp as ifVerifyPhoneOtp } from "./phone-otp";
import { recordLogin, endCurrentSession } from "./security-api";

// --- Types ---

type AuthResult = { ok: boolean; user?: User; message?: string; needsVerification?: boolean };

type AuthState = "IDLE" | "AUTHENTICATING" | "RESOLVING" | "ADMITTED" | "ERROR";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  authState: AuthState;
  authError: string | null;
  roles: Role[];
  signIn: (email: string, password: string, intent?: Role) => Promise<AuthResult>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<AuthResult>;
  signInWithProvider: (provider: OAuthProvider, intent?: Role) => Promise<{ ok: boolean; message?: string }>;
  phoneOtpEnabled: boolean;
  requestPhoneOtp: (phone: string) => Promise<{ ok: boolean; message?: string; resendAfter: number }>;
  verifyPhoneLogin: (phone: string, otp: string, intent?: Role) => Promise<AuthResult>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  oauthError: string | null;
  clearOAuthError: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);

// --- Constants ---
const ALL_ROLES: Role[] = ["customer", "partner", "rider", "admin", "manager"];

export const ROLE_HOME: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
  manager: "/manager",
};

export const ROLE_ONBOARDING: Record<Role, string> = {
  customer: "/app",
  partner: "/partner/onboarding",
  rider: "/rider/onboarding",
  admin: "/admin",
  manager: "/manager/onboarding",
};

// --- 1. Pure Resolution Logic ---

export function getRequestedPortal(pathname: string, search?: string | URLSearchParams): Role | null {
  if (typeof window === "undefined") return null;
  const params = typeof search === "string" ? new URLSearchParams(search) : (search || new URLSearchParams(window.location.search));
  
  const appParam = params.get("app");
  if (appParam && ALL_ROLES.includes(appParam as Role)) return appParam as Role;
  
  const p = pathname.toLowerCase();
  if (p.includes("/partner") || p.includes("/merchant")) return "partner";
  if (p.includes("/rider")) return "rider";
  if (p.includes("/manager")) return "manager";
  if (p.includes("/admin")) return "admin";
  
  return null;
}

export async function resolveUserMemberships(userId: string) {
  const debug = (stage: string, data: any) => {
    console.log(`[AUTH_DEBUG] stage: membership_query | sub_stage: ${stage} | userId: ${userId}`, data);
  };

  try {
    debug("start", {});
    const [drivers, managers, admins, restaurants] = await Promise.all([
      listTable<{ id: string }>("drivers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch((e) => {
        debug("drivers_error", { error: e.message });
        return [];
      }),
      listTable<{ id: string }>("merchant_managers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch((e) => {
        debug("managers_error", { error: e.message });
        return [];
      }),
      listTable<{ id: string; status?: string }>("platform_admins", { user_id: `eq.${userId}`, select: "id,status", limit: 1 }).catch((e) => {
        debug("admins_error", { error: e.message });
        return [];
      }),
      listTable<{ id: string; manager_id?: string; owner_id?: string }>("restaurants", { 
        or: `(manager_id.eq.${userId},owner_id.eq.${userId})`, 
        select: "id,manager_id,owner_id", 
        limit: 1 
      }).catch((e) => {
        debug("restaurants_error", { error: e.message });
        return [];
      })
    ]);

    const result = {
      customer: true,
      rider: drivers.length > 0,
      manager: managers.length > 0,
      admin: admins.length > 0 && admins[0]?.status !== "disabled",
      partner: restaurants.length > 0
    };
    debug("complete", { result, counts: { drivers: drivers.length, managers: managers.length, admins: admins.length, restaurants: restaurants.length } });
    return result;
  } catch (err: any) {
    debug("fatal_error", { error: err.message });
    throw err;
  }
}

export function resolveAuthenticatedDestination({ 
  requestedPortal, 
  memberships 
}: { 
  requestedPortal: Role | null; 
  memberships: Record<Role, boolean>;
}): string {
  const portal = requestedPortal || "customer";

  if (portal === "admin") return memberships.admin ? ROLE_HOME.admin : "/admin/login";
  if (portal === "manager") return memberships.manager ? ROLE_HOME.manager : ROLE_ONBOARDING.manager;
  if (portal === "partner") return memberships.partner ? ROLE_HOME.partner : ROLE_ONBOARDING.partner;
  if (portal === "rider") return memberships.rider ? ROLE_HOME.rider : ROLE_ONBOARDING.rider;
  if (portal === "customer") return ROLE_HOME.customer;

  // Fallback if no intent
  if (memberships.admin) return ROLE_HOME.admin;
  if (memberships.manager) return ROLE_HOME.manager;
  if (memberships.partner) return ROLE_HOME.partner;
  if (memberships.rider) return ROLE_HOME.rider;
  
  return ROLE_HOME.customer;
}

// --- 2. Side-Effect Helpers ---

async function syncProfile(sess: InsForgeUser, intent?: Role): Promise<User | null> {
  if (!sess?.id) return null;
  
  const existing = await fetchUserProfile(sess.id);
  const memberships = await resolveUserMemberships(sess.id);
  const roles: Role[] = ALL_ROLES.filter(r => memberships[r as keyof typeof memberships]);

  const email = (sess.email || existing?.email || "").toLowerCase();
  const name = existing?.name || (sess.profile?.name as string) || (sess.metadata?.name as string) || email.split("@")[0] || "User";
  const avatar = existing?.avatar || (sess.profile?.avatar_url as string);
  const phone = existing?.phone || "";

  const profileRow: UserProfileRow = {
    id: sess.id,
    email: email || null,
    name,
    phone: phone || null,
    avatar: avatar ?? null,
    status: existing?.status ?? "active",
    email_verified: sess.emailVerified ?? existing?.email_verified ?? false,
    last_login_at: new Date().toISOString(),
    referral_code: existing?.referral_code || referralCodeFor(sess.id, name),
    wallet_balance: existing?.wallet_balance ?? 0,
    loyalty_points: existing?.loyalty_points ?? 0,
  };

  const saved = await upsertUserProfile(profileRow, { writeRole: !existing }).catch(() => null);

  return {
    id: sess.id,
    name: saved?.name || name,
    email: saved?.email || email,
    phone: saved?.phone || phone,
    role: intent || roles[0] || "customer",
    roles,
    avatar: saved?.avatar || avatar,
  };
}

// --- 3. Provider ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>("IDLE");
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleAdmission = useCallback(async (sess: InsForgeUser, intent?: Role) => {
    if (typeof window === "undefined") return;
    
    const sessionId = sess?.id;
    const requestedPortal = intent || getRequestedPortal(window.location.pathname, window.location.search);
    
    const debug = (stage: string, data: any = {}) => {
      console.log(`[AUTH_DEBUG] stage: ${stage} | sessionId: ${sessionId} | requestedPortal: ${requestedPortal} | authState: RESOLVING | loading: true`, data);
    };

    setAuthState("RESOLVING");
    setLoading(true);

    const timeout = setTimeout(() => {
      console.warn(`[AUTH_DEBUG_TIMEOUT] stage: admission | sessionId: ${sessionId} | requestedPortal: ${requestedPortal} | url: ${window.location.href}`);
    }, 10000);

    try {
      debug("sync_profile_start");
      const profile = await syncProfile(sess, intent);
      debug("sync_profile_end", { profile: !!profile });
      
      if (!profile) throw new Error("Could not sync profile");
      setUser(profile);

      debug("membership_check_start");
      const memberships = await resolveUserMemberships(sess.id);
      debug("membership_check_end", { memberships });

      debug("destination_calc_start");
      const destination = resolveAuthenticatedDestination({
        requestedPortal: intent || null,
        memberships
      });
      debug("destination_calc_end", { destination });

      console.log(`[AUTH_ADMISSION] Admission Success: ${sess.id} -> ${destination} (Intent: ${intent || "none"})`);
      
      // Perform navigation ONCE
      if (window.location.pathname !== destination) {
        debug("navigating", { to: destination });
        window.location.assign(destination);
      } else {
        debug("already_at_destination");
        setAuthState("ADMITTED");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("[AUTH_DEBUG] stage: fatal_admission_error", { error: err.message, stack: err.stack });
      setAuthError(err.message || "Admission failed");
      setAuthState("ERROR");
      setLoading(false);
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  // Bootup: Restore session
  useEffect(() => {
    let active = true;
    void (async () => {
      console.log("[AUTH_DEBUG] stage: bootup_start");
      try {
        const sess = await ifGetSession();
        console.log("[AUTH_DEBUG] stage: get_session", { hasSession: !!sess, sessionId: sess?.id });
        
        if (sess && active) {
          const intent = getRequestedPortal(window.location.pathname, window.location.search);
          const p = window.location.pathname;
          console.log("[AUTH_DEBUG] stage: bootup_intent", { intent, path: p });

          if (p === "/" || p.startsWith("/auth/login") || p.includes("/onboarding")) {
             console.log("[AUTH_DEBUG] stage: triggering_admission");
             await handleAdmission(sess, intent || undefined);
          } else {
             console.log("[AUTH_DEBUG] stage: silent_profile_sync");
             const profile = await syncProfile(sess, intent || undefined);
             if (profile && active) setUser(profile);
             setAuthState("ADMITTED");
             setLoading(false);
          }
        } else if (active) {
          console.log("[AUTH_DEBUG] stage: no_session_detected");
          setLoading(false);
        }
      } catch (e: any) {
        console.error("[AUTH_DEBUG] stage: bootup_fatal", { error: e.message });
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [handleAdmission]);

  const signIn = useCallback(async (email: string, password: string, intent?: Role) => {
    setAuthState("AUTHENTICATING");
    try {
      const res = await ifLogin(email, password);
      recordLogin({ userId: res.user.id, event: "login", success: true });
      await handleAdmission(res.user, intent);
      return { ok: true };
    } catch (e: any) {
      setAuthState("ERROR");
      return { ok: false, message: e.message || "Sign in failed" };
    }
  }, [handleAdmission]);

  const signUp = useCallback(async (input: { name: string; email: string; phone: string; password: string; role: Role }) => {
    setAuthState("AUTHENTICATING");
    try {
      const res = await ifSignup(input.email, input.password, input.name);
      if (res.requireEmailVerification) return { ok: true, needsVerification: true };
      if (res.user) {
        recordLogin({ userId: res.user.id, event: "login", success: true });
        await handleAdmission(res.user, input.role);
        return { ok: true };
      }
      throw new Error("Session could not be established");
    } catch (e: any) {
      setAuthState("ERROR");
      return { ok: false, message: e.message || "Sign up failed" };
    }
  }, [handleAdmission]);

  const signInWithProvider = useCallback(async (provider: OAuthProvider, intent?: Role) => {
    try {
      const redirectUri = `${window.location.origin}/auth/login`;
      const meta = intent ? { app: intent } : undefined;
      await ifCreateOAuthUrl(provider, redirectUri, meta).then(navigateToOAuthUrl);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e.message || "OAuth failed" };
    }
  }, []);

  const requestPhoneOtp = useCallback(async (phone: string) => {
    return ifSendPhoneOtp(phone);
  }, []);

  const verifyPhoneLogin = useCallback(async (phone: string, otp: string, intent?: Role) => {
    setAuthState("AUTHENTICATING");
    try {
      const res = await ifVerifyPhoneOtp(phone, otp);
      if (res.ok && res.userId) {
        const sess: InsForgeUser = { id: res.userId, email: "" };
        recordLogin({ userId: sess.id, event: "login", success: true, provider: "phone" });
        await handleAdmission(sess, intent);
        return { ok: true };
      }
      return { ok: false, message: res.message || "Verification failed" };
    } catch (e: any) {
      setAuthState("ERROR");
      return { ok: false, message: e.message || "Verification failed" };
    }
  }, [handleAdmission]);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    try {
      const sess = await ifVerifyEmail(email, code);
      if (sess) {
        await handleAdmission(sess);
        return { ok: true };
      }
      return { ok: false, message: "Email verified but session failed" };
    } catch (e: any) {
      return { ok: false, message: e.message || "Verification failed" };
    }
  }, [handleAdmission]);

  const resendVerification = useCallback(async (email: string) => {
    try {
      await ifResendVerificationEmail(email);
      return { ok: true, message: "Verification email sent" };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    const uid = user?.id;
    await ifLogout();
    setUser(null);
    setAuthState("IDLE");
    if (uid) endCurrentSession(uid);
    if (typeof window !== "undefined") {
      window.location.assign("/auth/login");
    }
  }, [user?.id]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await ifSendPasswordReset(email);
      return { ok: true, message: "Reset email sent" };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }, []);

  // OAuth Callback Handler
  useEffect(() => {
    const callback = readOAuthCallback();
    if (callback) {
      clearOAuthParamsFromUrl();
      setAuthState("AUTHENTICATING");
      setLoading(true);
      void (async () => {
        try {
          const { user: sess } = await ifCompleteOAuth(callback.code);
          const intent = (callback.meta?.app as Role) || getRequestedPortal(window.location.pathname);
          recordLogin({ userId: sess.id, event: "oauth", success: true });
          await handleAdmission(sess, intent);
        } catch (e: any) {
          setOauthError(e.message || "OAuth exchange failed");
          setAuthState("ERROR");
        } finally {
          setLoading(false);
        }
      })();
    } else {
      const error = readOAuthError();
      if (error) {
        setOauthError(error);
        clearOAuthParamsFromUrl();
      }
    }
  }, [handleAdmission]);

  const value = {
    user,
    loading,
    authState,
    authError,
    roles: user?.roles || [],
    signIn,
    signUp,
    signInWithProvider,
    phoneOtpEnabled: isPhoneOtpEnabled(),
    requestPhoneOtp,
    verifyPhoneLogin,
    verifyEmailCode,
    resendVerification,
    signOut,
    oauthError,
    clearOAuthError: () => setOauthError(null),
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

