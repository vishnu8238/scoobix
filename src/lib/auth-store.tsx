import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { getAccessToken, setAccessToken, logout as ifLogout } from "./insforge-auth";
import { listTable } from "./insforge-crud";

/**
 * SCOOBIX — PHASE 1 AUTH REBUILD
 * Canonical user identity and membership resolution.
 */

export type Role = "customer" | "partner" | "rider" | "admin" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: Role;
  roles: Role[];
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (provider: 'google' | 'apple', portal?: string) => Promise<void>;
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

/**
 * Resolves the portal intent from the URL.
 * Authoritative source for current portal context.
 */
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

  const resolveUser = useCallback(async (token: string) => {
    try {
      // 1. Get user profile from InsForge
      // Assuming 'users' table contains canonical profile linked to Auth UUID
      // In InsForge, when authenticated, listTable uses the bearer token.
      const profiles = await listTable<any>("users", { limit: 1 });
      const profile = profiles[0];

      if (!profile) {
        setAccessToken(null);
        setUser(null);
        return;
      }

      // 2. Resolve Memberships (Customer is implicit for any auth user)
      const roles: Role[] = ["customer"];
      
      const [partner, rider, manager] = await Promise.all([
        listTable("restaurants", { owner_id: `eq.${profile.id}`, limit: 1 }),
        listTable("drivers", { user_id: `eq.${profile.id}`, limit: 1 }),
        listTable("merchant_managers", { user_id: `eq.${profile.id}`, limit: 1 }),
      ]);

      if (partner.length) roles.push("partner");
      if (rider.length) roles.push("rider");
      if (manager.length) roles.push("manager");
      if (profile.role === "admin") roles.push("admin");

      setUser({
        id: profile.id,
        name: profile.name || "User",
        email: profile.email || "",
        phone: profile.phone || "",
        avatar: profile.avatar_url || "",
        role: roles.includes(getRequestedPortal() as Role) ? (getRequestedPortal() as Role) : roles[0],
        roles,
      });
    } catch (err) {
      console.error("[AUTH] Failed to resolve user:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      resolveUser(token);
    } else {
      setLoading(false);
    }
  }, [resolveUser]);

  const login = async (provider: 'google' | 'apple', portal: string = "customer") => {
    const { loginWithGoogle, loginWithApple } = await import("./insforge-auth");
    if (provider === 'google') await loginWithGoogle(portal);
    else await loginWithApple(portal);
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
