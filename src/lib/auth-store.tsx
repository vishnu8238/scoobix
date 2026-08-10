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
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (provider: 'google', portal?: string) => Promise<void>;
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
    try {
      setLoading(true);
      const session = await getSession();
      
      if (!session || !session.user) {
        setUser(null);
        return;
      }

      const authId = session.user.id;

      // 1. Get user profile
      const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 });
      const profile = profiles[0];

      if (!profile) {
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
      } catch (err) {
        console.error("Failed to resolve memberships:", err);
        // If a query fails, we do NOT remove roles. 
        // In a real failure, we might want to retry or show an error, 
        // but we definitely don't want to send the user to onboarding.
        return; 
      }

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
    } catch (err: any) {
      console.error("Failed to resolve user:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveUser();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
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

  const login = async (provider: 'google', portal: string = "customer") => {
    try {
      if (provider === 'google') await loginWithGoogle(portal);
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
