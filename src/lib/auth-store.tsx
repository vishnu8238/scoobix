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
import { resolveCanonicalUserId } from "./identity-links";
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
  requestedPortal: Role | null;
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

/**
 * Membership resolution. Takes the CANONICAL application identity only.
 *
 * SECURITY: this function must never receive or use an email address. Roles are
 * resolved exclusively from rows keyed by `canonicalUserId`. Cross-identity role
 * inheritance is only possible through an explicit `auth_identity_links` row
 * (see resolveCanonicalUserId), never through matching email strings.
 */
export async function resolveUserMemberships(canonicalUserId: string) {
  const [drivers, managers, admins, restaurants] = await Promise.all([
    listTable<{ id: string }>("drivers", { user_id: `eq.${canonicalUserId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("merchant_managers", { user_id: `eq.${canonicalUserId}`, select: "id", limit: 1 }).catch(() => []),
    listTable<{ id: string; status?: string }>("platform_admins", { user_id: `eq.${canonicalUserId}`, select: "id,status", limit: 1 }).catch(() => []),
    listTable<{ id: string }>("restaurants", { or: `(manager_id.eq.${canonicalUserId},owner_id.eq.${canonicalUserId})`, select: "id", limit: 1 }).catch(() => []),
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
  memberships,
  currentPath = "/"
}: { 
  requestedPortal: Role | null; 
  memberships: Record<Role, boolean>;
  currentPath?: string;
}): string {
  const portal = requestedPortal || "customer";
  
  // If the user is already on a valid portal path (e.g. /manager/onboarding), 
  // and we are NOT on a login page, preserve that path.
  const path = currentPath.toLowerCase();
  if (portal === "manager" && path.startsWith("/manager")) return currentPath;
  if (portal === "partner" && path.startsWith("/partner")) return currentPath;
  if (portal === "rider" && path.startsWith("/rider")) return currentPath;
  if (portal === "admin" && path.startsWith("/admin")) return currentPath;

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
  const [requestedPortal, setRequestedPortalState] = useState<Role | null>(null);

  const admit = useCallback(async (sess: InsForgeUser, intent?: Role) => {
    setAuthState("RESOLVING");
    setLoading(true);
    setAuthError(null);
    const portalIntent = intent || getRequestedPortal(window.location.pathname);
    setRequestedPortalState(portalIntent);
    
    try {
      console.log(`[PORTAL_TRACE] admission_start: ${sess.id} intent: ${portalIntent || "none"}`);
      console.log(`[PORTAL_TRACE] session_uuid: ${sess.id}`);
      
      // 1. Resolve the CANONICAL application identity for this Auth UUID.
      //    Only an explicit auth_identity_links row can map this session onto a
      //    different canonical identity. No email matching, ever.
      const { canonicalUserId, linked } = await resolveCanonicalUserId(sess.id);
      console.log(`[AUTH_DEBUG] CANONICAL_IDENTITY: ${canonicalUserId} (explicit link: ${linked})`);

      // 2. Resolve Profile (keyed by canonical identity)
      console.log(`[AUTH_DEBUG] PROFILE_START`);
      const profile = await fetchUserProfile(canonicalUserId);
      const email = profile?.email || sess.email || "";
      const name = profile?.name || sess.metadata?.name as string || email.split("@")[0] || "User";

      if (!profile) {
        console.log(`[AUTH_ADMISSION] Creating missing profile for ${canonicalUserId}`);
        await upsertUserProfile({
          id: canonicalUserId,
          email,
          name,
          referral_code: referralCodeFor(canonicalUserId, name)
        });
      }
      console.log(`[AUTH_DEBUG] PROFILE_SUCCESS`);

      // 3. Resolve Memberships — canonical identity only
      console.log(`[AUTH_DEBUG] MEMBERSHIP_RESOLUTION_STARTED`);
      const requestedPortal = intent || getRequestedPortal(window.location.pathname);
      const memberships = await resolveUserMemberships(canonicalUserId);
      console.log(`[AUTH_DEBUG] MEMBERSHIP_RESOLUTION_RESULT:`, memberships);
      const activeRoles = (Object.keys(memberships) as Role[]).filter(r => memberships[r]);

      // 4. Update User State
      setUser({
        id: canonicalUserId,
        name,
        email,
        phone: profile?.phone || "",
        role: requestedPortal || activeRoles[0] || "customer",
        roles: activeRoles,
        avatar: profile?.avatar || undefined,
      });

      // 4. Determine Destination
      const destination = resolveAuthenticatedDestination({ 
        requestedPortal, 
        memberships,
        currentPath: window.location.pathname 
      });
      
      console.log(`[PORTAL_TRACE] admission_result: SUCCESS`);
      console.log(`[PORTAL_TRACE] destination: ${destination}`);
      
      // 5. Navigate exactly once
      setAuthState("ADMITTED");
      setLoading(false);
      
      const current = window.location.pathname;
      const isLoginOrSplash = current === "/" || current.startsWith("/auth/login");

      if (isLoginOrSplash || (current !== destination && !current.startsWith(destination))) {
        console.log(`[PORTAL_TRACE] navigation_start: ${destination}`);
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
          setRequestedPortalState(intent);
          const isLoginPage = window.location.pathname === "/" || window.location.pathname.startsWith("/auth/login");
          
          if (isLoginPage) {
            console.log(`[PORTAL_TRACE] session_restore: on_login_page_with_session`);
            await admit(sess, intent || undefined);
          } else {
            // Already inside the app, just sync state silently
            console.log(`[PORTAL_TRACE] session_restore: active_path_sync`);
            const { canonicalUserId } = await resolveCanonicalUserId(sess.id);
            const memberships = await resolveUserMemberships(canonicalUserId);
            const profile = await fetchUserProfile(canonicalUserId);
            if (!active) return;

            const activeRoles = (Object.keys(memberships) as Role[]).filter(r => memberships[r]);
            
            setUser({
              id: canonicalUserId,
              name: profile?.name || sess.email.split("@")[0] || "User",
              email: profile?.email || sess.email,
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
          // If we are authenticated but have no session, we stay IDLE.
          // The RoleGuard or Splash will handle the redirect to login if necessary.
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
    const error = readOAuthError();
    
    if (error) {
      console.error("[OAUTH_DEBUG] Provider returned error:", error);
      setOauthError(error);
      clearOAuthParamsFromUrl();
      return;
    }

    if (callback) {
      console.log("[OAUTH_DEBUG] OAuth callback detected", { 
        provider: callback.provider, 
        hasCode: !!callback.code,
        meta: callback.meta 
      });
      clearOAuthParamsFromUrl();
      setAuthState("AUTHENTICATING");
      setLoading(true);
      void (async () => {
        try {
          console.log("[OAUTH_DEBUG] ifCompleteOAuth starting...");
          const { user: sess } = await ifCompleteOAuth(callback.code);
          console.log("[OAUTH_DEBUG] ifCompleteOAuth success. User ID:", sess.id);
          
          console.log("[OAUTH_DEBUG] Verifying token persistence...");
          const hasAccessToken = !!localStorage.getItem("scoobix_if_access_v1");
          const hasRefreshToken = !!localStorage.getItem("scoobix_if_refresh_v1");
          console.log("[OAUTH_DEBUG] Tokens in storage:", { access: hasAccessToken, refresh: hasRefreshToken });

          await admit(sess, (callback.meta?.app as Role) || undefined);
        } catch (e: any) {
          console.error("[OAUTH_DEBUG] ifCompleteOAuth failed:", e.message);
          setOauthError(e.message);
          setAuthState("ERROR");
          setLoading(false);
        }
      })();
    }
  }, [admit]);

  const value = {
    user, loading, authState, authError, oauthError, requestedPortal,
    roles: user?.roles || [],
    signIn: async (email: string, password: string, intent?: Role) => {
      console.log("[AUTH_DEBUG] LOGIN_BUTTON_CLICKED", { email, intent });
      setAuthState("AUTHENTICATING");
      try {
        console.log("[AUTH_DEBUG] INSFORGE_LOGIN_REQUEST_SENT");
        const res = await ifLogin(email, password);
        console.log("[AUTH_DEBUG] INSFORGE_LOGIN_RESPONSE: SUCCESS");
        console.log("[AUTH_DEBUG] ACCESS_TOKEN_RECEIVED", res.accessToken ? "YES" : "NO");
        console.log("[AUTH_DEBUG] REFRESH_TOKEN_RECEIVED", res.refreshToken ? "YES" : "NO");
        
        recordLogin({ userId: res.user.id, event: "login", success: true });
        await admit(res.user, intent);
        return { ok: true };
      } catch (e: any) {
        console.error("[AUTH_DEBUG] INSFORGE_LOGIN_RESPONSE: ERROR", e.message);
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
