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

type AuthCtx = {
  user: User | null;
  loading: boolean;
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

// --- 1. Portal intent detection ---

const ALL_ROLES: Role[] = ["customer", "partner", "rider", "admin", "manager"];

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
  
  return "customer";
}

// --- 2. Membership resolution ---

async function userIsMerchantManager(userId: string): Promise<boolean> {
  try {
    const [managerRows, restaurantRows] = await Promise.all([
      listTable<{ id: string }>("merchant_managers", { user_id: `eq.${userId}`, select: "id", limit: 1 }),
      listTable<{ id: string }>("restaurants", { manager_id: `eq.${userId}`, select: "id", limit: 1 })
    ]);
    return !!managerRows[0]?.id || !!restaurantRows[0]?.id;
  } catch { return false; }
}

async function userIsPlatformAdmin(userId: string, email: string): Promise<boolean> {
  try {
    const rows = await listTable<{ id: string; status?: string }>("platform_admins", {
      select: "id,status",
      limit: 1,
      user_id: `eq.${userId}`,
    });
    if (rows[0]?.id && rows[0].status !== "disabled") return true;
    if (email) {
      const emailRows = await listTable<{ id: string; status?: string }>("platform_admins", {
        select: "id,status",
        limit: 1,
        email: `eq.${email.toLowerCase()}`,
      });
      return !!emailRows[0]?.id && emailRows[0].status !== "disabled";
    }
    return false;
  } catch { return false; }
}

export async function resolveUserMemberships(userId: string, email: string) {
  const [isRider, isManager, isAdmin, ownedRestaurants, managedRestaurants] = await Promise.all([
    listTable<{ id: string }>("drivers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).then(rows => !!rows[0]?.id).catch(() => false),
    userIsMerchantManager(userId),
    userIsPlatformAdmin(userId, email),
    listTable<{ id: string }>("restaurants", { owner_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("restaurants", { manager_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => [])
  ]);

  return {
    customer: true,
    rider: isRider,
    manager: isManager,
    admin: isAdmin,
    partner: ownedRestaurants.length > 0 || managedRestaurants.length > 0
  };
}

// --- 3. Admission function ---

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

export function resolveAuthenticatedDestination({ 
  requestedPortal, 
  memberships 
}: { 
  requestedPortal: Role | null; 
  memberships: Record<Role, boolean>;
}): string {
  const portal = requestedPortal || "customer";

  if (portal === "customer") return ROLE_HOME.customer;
  if (portal === "partner") return memberships.partner ? ROLE_HOME.partner : ROLE_ONBOARDING.partner;
  if (portal === "rider") return memberships.rider ? ROLE_HOME.rider : ROLE_ONBOARDING.rider;
  if (portal === "manager") return memberships.manager ? ROLE_HOME.manager : ROLE_ONBOARDING.manager;
  if (portal === "admin") return memberships.admin ? ROLE_HOME.admin : "/admin/login";

  if (memberships.admin) return ROLE_HOME.admin;
  if (memberships.manager) return ROLE_HOME.manager;
  if (memberships.partner) return ROLE_HOME.partner;
  if (memberships.rider) return ROLE_HOME.rider;
  
  return ROLE_HOME.customer;
}

// --- 4. Profile Sync ---

async function syncProfile(sess: InsForgeUser, intent?: Role): Promise<User | null> {
  if (!sess?.id) return null;
  
  const email = (sess.email || "").toLowerCase();
  const existing = await fetchUserProfile(sess.id);
  const memberships = await resolveUserMemberships(sess.id, email);
  const roles: Role[] = ALL_ROLES.filter(r => memberships[r as keyof typeof memberships]);

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
    role: intent || "customer",
    roles,
    avatar: saved?.avatar || avatar,
  };
}

// --- 5. Navigation Authority ---

async function handleAuthenticatedAdmission(sess: InsForgeUser, intent?: Role) {
  if (typeof window === "undefined") return null;
  
  console.log(`[AUTH_ADMISSION] Starting admission for ${sess.id} with intent ${intent || "none"}`);
  
  const user = await syncProfile(sess, intent);
  if (!user) return null;

  const memberships = await resolveUserMemberships(sess.id, user.email);
  const destination = resolveAuthenticatedDestination({
    requestedPortal: intent || null,
    memberships
  });

  console.log(`[AUTH_ADMISSION] Final destination: ${destination}`);
  window.location.assign(destination);
  return user;
}

// --- Provider ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const sess = await ifGetSession();
        if (sess && active) {
          const intent = getRequestedPortal(window.location.pathname, window.location.search);
          const profile = await syncProfile(sess, intent || undefined);
          if (profile && active) {
             setUser(profile);
             const p = window.location.pathname;
             if (p === "/" || p.startsWith("/auth/login")) {
                const memberships = await resolveUserMemberships(profile.id, profile.email);
                const dest = resolveAuthenticatedDestination({ requestedPortal: intent, memberships });
                if (p !== dest) window.location.assign(dest);
             }
          }
        }
      } catch (e) {
        console.error("Auth boot failed", e);
      } finally {
      if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string, intent?: Role) => {
    try {
      const res = await ifLogin(email, password);
      const profile = await handleAuthenticatedAdmission(res.user, intent);
      if (profile) {
        setUser(profile);
        recordLogin(profile.id, "email");
        return { ok: true, user: profile };
      }
      return { ok: false, message: "Could not establish session" };
    } catch (e: any) {
      return { ok: false, message: e.message || "Sign in failed" };
    }
  }, []);

  const signUp = useCallback(async (input: { name: string; email: string; phone: string; password: string; role: Role }) => {
    try {
      const res = await ifSignup(input.email, input.password, input.name);
      if (res.requireEmailVerification) return { ok: true, needsVerification: true };
      if (res.user) {
        const profile = await handleAuthenticatedAdmission(res.user, input.role);
        if (profile) {
          setUser(profile);
          recordLogin(profile.id, "email");
          return { ok: true, user: profile };
        }
      }
      return { ok: false, message: "Account created but session could not be established" };
    } catch (e: any) {
      return { ok: false, message: e.message || "Sign up failed" };
    }
  }, []);

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
    try {
      const res = await ifVerifyPhoneOtp(phone, otp);
      if (res.ok && res.userId) {
        const sess: InsForgeUser = { id: res.userId, email: "" };
        const profile = await handleAuthenticatedAdmission(sess, intent);
        if (profile) {
          setUser(profile);
          recordLogin(profile.id, "phone");
          return { ok: true, user: profile };
        }
      }
      return { ok: false, message: res.message || "Verification failed" };
    } catch (e: any) {
      return { ok: false, message: e.message || "Verification failed" };
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    try {
      const sess = await ifVerifyEmail(email, code);
      if (sess) {
        const profile = await syncProfile(sess);
        if (profile) {
          setUser(profile);
          return { ok: true, user: profile };
        }
      }
      return { ok: false, message: "Email verified but profile failed" };
    } catch (e: any) {
      return { ok: false, message: e.message || "Verification failed" };
    }
  }, []);

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

  useEffect(() => {
    const callback = readOAuthCallback();
    if (callback) {
      clearOAuthParamsFromUrl();
      setLoading(true);
      void (async () => {
        try {
          const { user: sess } = await ifCompleteOAuth(callback.code);
          const intent = (callback.meta?.app as Role) || getRequestedPortal(window.location.pathname);
          const profile = await handleAuthenticatedAdmission(sess, intent);
          if (profile) {
            setUser(profile);
            recordLogin(profile.id, "oauth");
          }
        } catch (e: any) {
          setOauthError(e.message || "OAuth exchange failed");
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
  }, []);

  const value = {
    user,
    loading,
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
