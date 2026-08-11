import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { loginWithGoogle, logout as ifLogout, getSession } from "./insforge-auth";
import { insforge } from "./insforge";
import { listTable } from "./insforge-crud";

export type Role = "customer" | "partner" | "rider" | "admin" | "manager" | "logistics";

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
  if (path.startsWith("/logistics")) return "logistics";
  return "customer";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUser = useCallback(async () => {
    let currentSession = null;
    try {
      setLoading(true);
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_LOADING] Loading: true");
      currentSession = await getSession();
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_SESSION_RESTORED] Session ID:", currentSession?.user?.id);
      
      if (!currentSession || !currentSession.user) {
        setUser(null);
        return;
      }

      const authId = currentSession.user.id;

      // 1. Get user profile
      const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 });
      const profile = profiles[0];
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_USER_RESOLVED] Profile ID:", profile?.id);

      if (!profile) {
        // No profile row: check for logistics authorization by email even without profile
        const roles: Role[] = ["customer"];
        const { isLogisticsStaffEmail } = await import("./logistics-authorization");
        if (await isLogisticsStaffEmail(currentSession.user.email)) roles.push("logistics");


        console.log("[AUTH_DEBUG] [CHECKPOINT: MEMBERSHIPS_RESOLVED] Result: basic-customer (no profile)");
        setUser({
          id: authId,
          name: (currentSession.user.profile as any)?.name || "New User",
          email: currentSession.user.email || "",
          phone: "",
          avatar: "",
          role: roles.includes("logistics") ? "logistics" : "customer",
          roles,
          membershipsResolved: true,
          pendingPortal: getRequestedPortal() as Role,
        });
        return;
      }

      // 2. Resolve Memberships
      const roles: Role[] = ["customer"];
      
      // Authoritative logistics check by email
      const logisticsStaff = await listTable("logistics_staff", { email: `eq.${profile.email}`, limit: 1 }, { ttl: 0 });
      if (logisticsStaff.length > 0) roles.push("logistics");

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
        if (profile.role === "admin" || profile.is_admin === true) roles.push("admin");
      }
      console.log("[AUTH_DEBUG] [CHECKPOINT: MEMBERSHIPS_RESOLVED] Roles:", roles);

      const currentPortal = getRequestedPortal() as Role;
      const admissionResult = roles.includes(currentPortal);
      console.log(`[AUTH_DEBUG] [CHECKPOINT: CUSTOMER_ADMISSION_RESULT] Portal: ${currentPortal}, Admitted: ${admissionResult}`);

      setUser({
        id: profile.id,
        name: profile.name || "User",
        email: profile.email || "",
        phone: profile.phone || "",
        avatar: profile.avatar_url || "",
        role: roles.includes(currentPortal) ? currentPortal : (currentPortal === "logistics" && roles.includes("logistics") ? "logistics" : roles[0]),
        roles,
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });
    } catch (err: any) {
      console.error("Failed to resolve user:", err);
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
    console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_MOUNT] Initializing auth listener");
    resolveUser();

    const unsubscribe = insforge.auth.onAuthStateChange((event: string) => {
      console.log(`[AUTH_DEBUG] Auth State Change: ${event}`);
      if (event === 'signedIn' || event === 'tokenRefreshed') {
        console.log("[AUTH_TRACE] Auth State Event: SIGNED_IN/TOKEN_REFRESHED -> Resolving User");
        resolveUser();
      } else if (event === 'signedOut') {
        console.log("[AUTH_TRACE] Auth State Event: SIGNED_OUT");
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_UNMOUNT]");
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