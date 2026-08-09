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

// --- Constants ---
export const ALL_ROLES: Role[] = ["customer", "partner", "rider", "admin", "manager"];

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

// --- Types ---
export type AuthState = "IDLE" | "AUTHENTICATING" | "RESOLVING" | "ADMITTED" | "ERROR";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  authState: AuthState;
  authError: string | null;
  roles: Role[];
  signIn: (email: string, password: string, intent?: Role) => Promise<{ ok: boolean; message?: string; needsVerification?: boolean }>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<{ ok: boolean; message?: string; needsVerification?: boolean }>;
  signInWithProvider: (provider: OAuthProvider, intent?: Role) => Promise<{ ok: boolean; message?: string }>;
  phoneOtpEnabled: boolean;
  requestPhoneOtp: (phone: string) => Promise<{ ok: boolean; message?: string; resendAfter: number }>;
  verifyPhoneLogin: (phone: string, otp: string, intent?: Role) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  oauthError: string | null;
  clearOAuthError: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  resendVerification: (email: string) => Promise<{ ok: boolean; message: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ ok: boolean; message?: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);

// --- 1. Pure Helpers ---

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
  const [drivers, managers, admins, restaurants] = await Promise.all([
    listTable<{ id: string }>("drivers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("merchant_managers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string; status?: string }>("platform_admins", { user_id: `eq.${userId}`, select: "id,status", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("restaurants", { or: `(manager_id.eq.${userId},owner_id.eq.${userId})`, select: "id", limit: 1 }).catch(() => []),
  ]);
  return {
    customer: true,
    rider: (drivers?.length ?? 0) > 0,
    manager: (managers?.length ?? 0) > 0,
    admin: (admins?.length ?? 0) > 0 && admins[0]?.status !== "disabled",
    partner: (restaurants?.length ?? 0) > 0
  };
}

export function resolveAuthenticatedDestination({ 
  requestedPortal, 
  memberships 
}: { 
  requestedPortal: Role | null; 
  memberships: Record<Role, boolean>;
}): string {
  const portal = requestedPortal || "customer";
  if (portal === "admin") return memberships.admin ? ROLE_HOME.admin : "/auth/login?app=admin";
  if (portal === "manager") return memberships.manager ? ROLE_HOME.manager : ROLE_ONBOARDING.manager;
  if (portal === "partner") return memberships.partner ? ROLE_HOME.partner : ROLE_ONBOARDING.partner;
  if (portal === "rider") return memberships.rider ? ROLE_HOME.rider : ROLE_ONBOARDING.rider;
  return ROLE_HOME.customer;
}

// --- 2. Auth Provider ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>("IDLE");
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const admit = useCallback(async (sess: InsForgeUser, intent?: Role) => {
    setAuthState("RESOLVING");
    setLoading(true);
    setAuthError(null);
    
    try {
      console.log(`[AUTH_ADMISSION] Starting admission for ${sess.id} with intent ${intent || "none"}`);
      
      // 1. Resolve Identity and Profile
      const profile = await fetchUserProfile(sess.id);
      const email = sess.email || profile?.email || "";
      const name = profile?.name || sess.metadata?.name as string || email.split("@")[0] || "User";

      if (!profile) {
        console.log(`[AUTH_ADMISSION] Creating missing profile for ${sess.id}`);
        await upsertUserProfile({
          id: sess.id,
          email,
          name,
          referral_code: referralCodeFor(sess.id, name)
        });
      }

      // 2. Resolve Memberships
      console.log(`[AUTH_ADMISSION] Resolving memberships for ${sess.id}`);
      const memberships = await resolveUserMemberships(sess.id);
      const activeRoles = (Object.keys(memberships) as Role[]).filter(r => memberships[r]);
      
      // 3. Update User State
      setUser({
        id: sess.id,
        name,
        email,
        phone: profile?.phone || "",
        role: intent || activeRoles[0] || "customer",
        roles: activeRoles,
        avatar: profile?.avatar || undefined,
      });

      // 4. Determine Destination
      const requestedPortal = intent || getRequestedPortal(window.location.pathname);
      const destination = resolveAuthenticatedDestination({ requestedPortal, memberships });
      
      console.log(`[AUTH_ADMISSION] Admission complete. Redirecting to ${destination}`);
      
      // 5. Navigate exactly once
      setAuthState("ADMITTED");
      setLoading(false);
      
      if (window.location.pathname !== destination) {
        window.location.assign(destination);
      }
    } catch (e: any) {
      console.error("[AUTH_ADMISSION] CRITICAL ERROR:", e);
      setAuthError(e.message || "Unable to verify your access. Please try again.");
      setAuthState("ERROR");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const sess = await ifGetSession();
        if (!active) return;
        
        if (sess) {
          const intent = getRequestedPortal(window.location.pathname);
          const isLoginPage = window.location.pathname === "/" || window.location.pathname.startsWith("/auth/login");
          
          if (isLoginPage) {
            // Admission handles the redirect if we are on a login/splash page
            await admit(sess, intent || undefined);
          } else {
            // Already inside the app, just sync state silently
            const memberships = await resolveUserMemberships(sess.id);
            const profile = await fetchUserProfile(sess.id);
            if (!active) return;

            const activeRoles = (Object.keys(memberships) as Role[]).filter(r => memberships[r]);
            
            setUser({
              id: sess.id,
              name: profile?.name || sess.email.split("@")[0] || "User",
              email: sess.email,
              phone: profile?.phone || "",
              role: intent || activeRoles[0] || "customer",
              roles: activeRoles,
              avatar: profile?.avatar || undefined,
            });
            setAuthState("ADMITTED");
            setLoading(false);
          }
        } else {
          setLoading(false);
          setAuthState("IDLE");
        }
      } catch (e) {
        console.error("[AUTH_BOOT] Boot failed:", e);
        if (active) {
          setLoading(false);
          setAuthState("IDLE");
        }
      }
    })();
    return () => { active = false; };
  }, [admit]);

  // OAuth Callback
  useEffect(() => {
    const callback = readOAuthCallback();
    if (callback) {
      clearOAuthParamsFromUrl();
      setAuthState("AUTHENTICATING");
      setLoading(true);
      void (async () => {
        try {
          const { user: sess } = await ifCompleteOAuth(callback.code);
          await admit(sess, (callback.meta?.app as Role) || undefined);
        } catch (e: any) {
          setOauthError(e.message);
          setAuthState("ERROR");
          setLoading(false);
        }
      })();
    }
  }, [admit]);

  const value = {
    user, loading, authState, authError, oauthError,
    roles: user?.roles || [],
    signIn: async (email: string, password: string, intent?: Role) => {
      setAuthState("AUTHENTICATING");
      try {
        const res = await ifLogin(email, password);
        recordLogin({ userId: res.user.id, event: "login", success: true });
        await admit(res.user, intent);
        return { ok: true };
      } catch (e: any) {
        setAuthState("ERROR");
        return { ok: false, message: e.message };
      }
    },
    signUp: async (input: { name: string; email: string; phone: string; password: string; role: Role }) => {
      setAuthState("AUTHENTICATING");
      try {
        const res = await ifSignup(input.email, input.password, input.name);
        if (res.requireEmailVerification) return { ok: true, needsVerification: true };
        if (res.user) {
          await admit(res.user, input.role);
          return { ok: true };
        }
        throw new Error("Signup failed");
      } catch (e: any) {
        setAuthState("ERROR");
        return { ok: false, message: e.message };
      }
    },
    signInWithProvider: async (provider: OAuthProvider, intent?: Role) => {
      try {
        const redirectUri = `${window.location.origin}/auth/login`;
        const meta = intent ? { app: intent } : undefined;
        await ifCreateOAuthUrl(provider, redirectUri, meta).then(navigateToOAuthUrl);
        return { ok: true };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    signOut: async () => {
      const uid = user?.id;
      await ifLogout();
      setUser(null);
      setAuthState("IDLE");
      if (uid) endCurrentSession(uid);
      window.location.assign("/auth/login");
    },
    phoneOtpEnabled: isPhoneOtpEnabled(),
    requestPhoneOtp: async (phone: string) => ifSendPhoneOtp(phone),
    verifyPhoneLogin: async (phone: string, otp: string, intent?: Role) => {
      setAuthState("AUTHENTICATING");
      try {
        const res = await ifVerifyPhoneOtp(phone, otp);
        if (res.ok && res.userId) {
          await admit({ id: res.userId, email: "" }, intent);
          return { ok: true };
        }
        return { ok: false, message: res.message };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    clearOAuthError: () => setOauthError(null),
    resetPassword: async (email: string) => {
      await ifSendPasswordReset(email);
      return { ok: true, message: "Reset email sent" };
    },
    resendVerification: async (email: string) => {
      await ifResendVerificationEmail(email);
      return { ok: true, message: "Verification email sent" };
    },
    verifyEmailCode: async (email: string, code: string) => {
      try {
        const sess = await ifVerifyEmail(email, code);
        if (sess) {
          await admit(sess);
          return { ok: true };
        }
        return { ok: false, message: "Verification failed" };
      } catch (e: any) {
        return { ok: false, message: e.message };
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
