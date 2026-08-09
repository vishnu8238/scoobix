import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Role, User } from "./types";
import {
  ifSignup,
  ifLogin,
  ifLogout,
  ifGetSession,
  ifCreateOAuthUrl,
  navigateToOAuthUrl,
  ifCompleteOAuth,
  readOAuthCallback,
  readOAuthError,
  clearOAuthParamsFromUrl,
  fetchUserProfile,
  upsertUserProfile,
  type InsForgeUser,
  type OAuthProvider,
  type UserProfileRow,
} from "./insforge-auth";
import { listTable } from "./insforge-crud";
import { recordLogin, endCurrentSession } from "./security-api";

// --- Types ---
export type AuthState = "IDLE" | "AUTHENTICATING" | "RESOLVING" | "ADMITTED" | "ERROR";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  authState: AuthState;
  authError: string | null;
  signIn: (email: string, password: string, intent?: Role) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>("IDLE");
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Membership Resolver
  const resolveMemberships = async (userId: string) => {
    const [drivers, managers, admins, restaurants] = await Promise.all([
      listTable<{ id: string }>("drivers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
      listTable<{ id: string }>("merchant_managers", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
      listTable<{ id: string }>("platform_admins", { user_id: `eq.${userId}`, select: "id", limit: 1 }).catch(() => []),
      listTable<{ id: string }>("restaurants", { or: `(manager_id.eq.${userId},owner_id.eq.${userId})`, select: "id", limit: 1 }).catch(() => []),
    ]);
    return {
      customer: true,
      rider: drivers.length > 0,
      manager: managers.length > 0,
      admin: admins.length > 0,
      partner: restaurants.length > 0
    };
  };

  // 2. Admission Logic
  const admit = useCallback(async (sess: InsForgeUser, intent?: Role) => {
    setAuthState("RESOLVING");
    try {
      const memberships = await resolveMemberships(sess.id);
      
      const profile = await upsertUserProfile({ id: sess.id, email: sess.email });
      setUser({
        id: sess.id,
        name: profile?.name || sess.email,
        email: sess.email,
        phone: profile?.phone || "",
        role: intent || "customer",
        roles: (Object.keys(memberships) as Role[]).filter(r => memberships[r]),
      });

      // Redirect Logic
      const requestedPortal = intent || new URLSearchParams(window.location.search).get("app") as Role;
      let dest = "/app";
      if (requestedPortal === "manager") dest = memberships.manager ? "/manager" : "/manager/onboarding";
      else if (requestedPortal === "partner") dest = memberships.partner ? "/partner" : "/partner/onboarding";
      else if (requestedPortal === "rider") dest = memberships.rider ? "/rider" : "/rider/onboarding";
      else if (requestedPortal === "admin") dest = memberships.admin ? "/admin" : "/auth/login?app=admin";
      
      window.location.assign(dest);
    } catch (e: any) {
      setAuthError(e.message);
      setAuthState("ERROR");
      setLoading(false);
    }
  }, []);

  // 3. Bootup
  useEffect(() => {
    void (async () => {
      const sess = await ifGetSession();
      if (sess) {
        await admit(sess);
      } else {
        setLoading(false);
      }
    })();
  }, [admit]);

  return (
    <AuthContext.Provider value={{
      user, loading, authState, authError,
      signIn: async (e, p, intent) => {
        try {
          const res = await ifLogin(e, p);
          await admit(res.user, intent);
          return { ok: true };
        } catch (e: any) { return { ok: false, message: e.message }; }
      },
      signOut: async () => {
        await ifLogout();
        window.location.assign("/auth/login");
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
