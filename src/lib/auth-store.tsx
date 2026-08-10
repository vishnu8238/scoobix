import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { loginWithGoogle, logout as ifLogout, getSession } from "./insforge-auth";
import { insforge } from "./insforge";
import { listTable } from "./insforge-crud";

export type Role = "customer" | "partner" | "rider" | "admin" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: Role;
  roles: Role[];
  /**
   * True only once real membership resolution has definitively completed.
   * While false, `roles` is NOT authoritative and must never be used to deny
   * access or redirect the user to a different portal.
   */
  membershipsResolved: boolean;
  /** Navigation context only — never an authorization source. */
  pendingPortal?: Role;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (provider: 'google', portal?: string, options?: { prompt?: 'select_account' | 'consent' | 'none' }) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  signOut: async () => {},
});

export const getRequestedPortal = () => {
  if (typeof window === "undefined") return "customer";
  const path = window.location.pathname;
  if (path.startsWith("/partner")) return "partner";
  if (path.startsWith("/rider")) return "rider";
  if (path.startsWith("/manager")) return "manager";
  if (path.startsWith("/admin")) return "admin";
  return "customer";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUser = useCallback(async () => {
    let currentSession = null;
    try {
      setLoading(true);
      currentSession = await getSession();
      console.log("[AUTH_DEBUG] resolveUser Session:", currentSession?.user?.id);
      
      if (!currentSession || !currentSession.user) {
        setUser(null);
        return;
      }

      const authId = currentSession.user.id;

      // 1. Get user profile
      const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 });
      const profile = profiles[0];
      console.log("[AUTH_DEBUG] resolveUser Profile:", profile?.id);

      if (!profile) {
        // No profile row: resolution is definitive — there are no memberships.
        setUser({
          id: authId,
          name: (currentSession.user.profile as any)?.name || "New User",
          email: currentSession.user.email || "",
          phone: "",
          avatar: "",
          role: "customer",
          roles: ["customer"],
          membershipsResolved: true,
          pendingPortal: getRequestedPortal() as Role,
        });
        return;
      }

      // 2. Resolve Memberships
      const roles: Role[] = ["customer"];
      
      try {
        const [partner, rider, manager] = await Promise.all([
          listTable("restaurants", { owner_id: `eq.${profile.id}`, limit: 1 }, { ttl: 0 }),
          listTable("drivers", { user_id: `eq.${profile.id}`, limit: 1 }, { ttl: 0 }),
          listTable("merchant_managers", { user_id: `eq.${profile.id}`, limit: 1 }, { ttl: 0 }),
        ]);

        if (partner.length > 0) roles.push("partner");
        if (rider.length > 0) roles.push("rider");
        if (manager.length > 0) roles.push("manager");
        
        // Strict admin check from profile
        if (profile.role === "admin" || profile.is_admin === true || profile.role === "MERCHANT_MANAGER") {
          // Note: profile.role "MERCHANT_MANAGER" indicates a manager user
          if (profile.role === "admin" || profile.is_admin === true) roles.push("admin");
        }
        console.log("[AUTH_DEBUG] resolveUser Resolved Roles:", roles);
      } catch (err) {
        console.error("Failed to resolve memberships:", err);
        // Resolution FAILED — it is not authoritative. Publish the user with
        // membershipsResolved=false so guards keep waiting instead of denying
        // access or bouncing the user to another portal.
        setUser({
          id: profile.id,
          name: profile.name || "User",
          email: profile.email || "",
          phone: profile.phone || "",
          avatar: profile.avatar_url || "",
          role: roles[0],
          roles,
          membershipsResolved: false,
          pendingPortal: getRequestedPortal() as Role,
        });
        return;
      }

      const currentPortal = getRequestedPortal() as Role;

      setUser({
        id: profile.id,
        name: profile.name || "User",
        email: profile.email || "",
        phone: profile.phone || "",
        avatar: profile.avatar_url || "",
        // Authoritative: only a real resolved membership can be the active role.
        role: roles.includes(currentPortal) ? currentPortal : roles[0],
        roles,
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });
    } catch (err: any) {
      console.error("Failed to resolve user:", err);
      // Fallback: If we have a session but resolution failed (e.g. database error),
      // treat them as a basic customer to prevent redirect loops.
      if (currentSession?.user) {
        setUser({
          id: currentSession.user.id,
          name: (currentSession.user.profile as any)?.name || "User",
          email: currentSession.user.email || "",
          phone: "",
          avatar: "",
          role: "customer",
          roles: ["customer"],
          membershipsResolved: false,
        });
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveUser();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log(`[AUTH_DEBUG] Auth State Change: ${event}`);
      // Single source of truth: resolveUser() handles session checks definitively.
      // This prevents the 'signedOut' event from prematurely ending the loading state
      // during initial SDK boot.
      if (event === 'signedIn' || event === 'tokenRefreshed' || event === 'signedOut') {
        resolveUser();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [resolveUser]);

  const login = async (provider: 'google', portal: string = "customer", options: { prompt?: 'select_account' | 'consent' | 'none' } = {}) => {
    try {
      if (provider === 'google') await loginWithGoogle(portal, options);
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  const logout = async () => {
    await ifLogout();
    setUser(null);
    window.location.assign("/");
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      signOut: logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
