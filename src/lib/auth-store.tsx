import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { loginWithGoogle, loginWithApple, logout as ifLogout, getSession } from "./insforge-auth";
import { insforge } from "./insforge";
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

  const resolveUser = useCallback(async () => {
    try {
      setLoading(true);
      const session = await getSession();
      if (!session || !session.user) {
        setUser(null);
        return;
      }

      const authId = session.user.id;
      console.log(`[AUTH] Resolving user for ${authId}`);

      // 1. Get user profile from InsForge
      const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 });
      const profile = profiles[0];

      if (!profile) {
        console.warn(`[AUTH] No profile found for ${authId}`);
        setUser({
          id: authId,
          name: (session.user.profile as any)?.name || "New User",
          email: session.user.email || "",
          phone: "",
          avatar: "",
          role: "customer",
          roles: ["customer"],
        });
        return;
      }

      // 2. Resolve Memberships
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

      const currentPortal = getRequestedPortal() as Role;
      
      setUser({
        id: profile.id,
        name: profile.name || "User",
        email: profile.email || "",
        phone: profile.phone || "",
        avatar: profile.avatar_url || "",
        role: roles.includes(currentPortal) ? currentPortal : roles[0],
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
    resolveUser();

    // The SDK uses lowercase event names in types
    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log(`[AUTH] Event: ${event}`);
      if (event === 'signedIn' || event === 'tokenRefreshed') {
        resolveUser();
      } else if (event === 'signedOut') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [resolveUser]);

  const login = async (provider: 'google' | 'apple', portal: string = "customer") => {
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
