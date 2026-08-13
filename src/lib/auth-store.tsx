import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { loginWithGoogle, logout as ifLogout } from "./insforge-auth";
import { insforge, getAccessToken } from "./insforge";
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
  const lastRequestedPortal = useRef<Role | null>(null);

  const resolveUser = useCallback(async (isInitialMountOrSignIn: boolean = false) => {
    let session = null;
    try {
      if (isInitialMountOrSignIn) {
        setLoading(true);
        console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_LOADING] Loading: true");
      }
      
      // Fix #1: Use async getAccessToken to hydrate from cookie on fresh mount
      const token = await getAccessToken();
      const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
      if (authError) {
         console.log("[AUTH_DEBUG] No current user session found:", authError.message);
         setUser(null);
         return;
      }
      session = userData;
      
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_SESSION_RESTORED] Session ID:", session?.user?.id);
      
      const { setCacheAuthScope } = await import("./request-cache");
      setCacheAuthScope(session?.user?.id || null);

      if (!session || !session.user) {
        setUser(null);
        return;
      }

      const authId = session.user.id;
      const currentPortal = getRequestedPortal() as Role;
      lastRequestedPortal.current = currentPortal;

      // 1. Get user profile
      let profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 });
      let profile = profiles[0];

      // Auto-create a users row on first sign-in
      if (!profile) {
        try {
          const { createRecord } = await import("./insforge-crud");
          const newProfile = await createRecord("users", {
            id: authId,
            email: session.user.email,
            email_normalized: session.user.email.toLowerCase(),
            name: session.user.name || "New User",
            phone: "",
            avatar_url: session.user.avatar_url || session.user.user_metadata?.picture || "",
            role: "customer", // Default role for new sign-ups
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          profile = newProfile;
          console.log("[AUTH_DEBUG] [CHECKPOINT: AUTO_CREATED_USER] New user created in database:", authId);
        } catch (err) {
          console.error("[AUTH_ERROR] Failed to auto-create user profile:", err);
          // Don't fail the login — fall through with just session data
          profile = null;
        }
      }
      console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_USER_RESOLVED] Profile ID:", profile?.id);

      if (!profile) {
        const roles: Role[] = ["customer"];
        const { isLogisticsStaffEmail } = await import("./logistics-authorization");
        if (await isLogisticsStaffEmail(session.user.email)) roles.push("logistics");

        console.log("[AUTH_DEBUG] [CHECKPOINT: MEMBERSHIPS_RESOLVED] Result: basic-customer (no profile)");
        setUser({
          id: authId,
          name: session.user.name || "New User",
          email: session.user.email || "",
          phone: "",
          avatar: "",
          role: roles.includes("logistics") ? "logistics" : "customer",
          roles,
          membershipsResolved: true,
          pendingPortal: currentPortal,
        });
        return;
      }

      // 2. Resolve Authoritative Portal Access (portal_access table)
      const roles: Role[] = ["customer"];
      const { checkPortalAccess } = await import("./portal-authorization");
      
      const SUPER_ADMIN = "scoobix.info@gmail.com";
      const isSuperAdmin = profile?.email === SUPER_ADMIN || session.user.email === SUPER_ADMIN || profile?.role === "admin";

      if (isSuperAdmin) {
        roles.push("admin", "logistics", "partner", "rider", "manager");
      } else {
        // Check portal_access for the specifically requested portal
        if (["partner", "rider", "manager", "logistics", "admin"].includes(currentPortal)) {
          const access = await checkPortalAccess(session.user.email, currentPortal as any);
          if (access.ok) {
            roles.push(currentPortal);
          }
        }
        
        // Background: Check for other active portal permissions to hydrate the roles list
        const otherPortals: Role[] = ["partner", "rider", "manager", "logistics", "admin"];
        for (const p of otherPortals) {
          if (p === currentPortal || roles.includes(p)) continue;
          const access = await checkPortalAccess(session.user.email, p as any);
          if (access.ok) roles.push(p);
        }
      }

      // 3. Resolve Business Memberships (Legacy Tables - Non-authoritative for admission)
      // These are still checked to support business logic/profiles, but they don't 
      // independently grant admission if portal_access exists for that portal.
      const [partner, rider, manager] = await Promise.all([
        listTable("restaurants", { owner_id: `eq.${profile.id}`, limit: 1 }),
        listTable("drivers", { user_id: `eq.${profile.id}`, limit: 1 }),
        listTable("merchant_managers", { user_id: `eq.${profile.id}`, limit: 1 }),
      ]);

      if (partner.length > 0 && !roles.includes("partner")) roles.push("partner");
      if (rider.length > 0 && !roles.includes("rider")) roles.push("rider");
      if (manager.length > 0 && !roles.includes("manager")) roles.push("manager");
      
      console.log("[AUTH_DEBUG] [CHECKPOINT: MEMBERSHIPS_RESOLVED] Roles:", roles);

      const admissionResult = roles.includes(currentPortal);
      console.log(`[AUTH_DEBUG] [CHECKPOINT: PORTAL_ADMISSION_RESULT] Portal: ${currentPortal}, Admitted: ${admissionResult}, Roles: ${roles.join(",")}`);

      // Determine the final role to set in the store. 
      // Priority: 1. Current portal if admitted, 2. Logistics if admitted, 3. First available role, 4. Customer.
      let finalRole: Role = "customer";
      if (admissionResult) {
        finalRole = currentPortal;
      } else if (roles.includes("logistics")) {
        finalRole = "logistics";
      } else if (roles.length > 0) {
        finalRole = roles[0];
      }

      setUser({
        id: profile.id,
        name: profile.name || "User",
        email: profile.email || "",
        phone: profile.phone || "",
        avatar: profile.avatar_url || "",
        role: finalRole,
        roles,
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });
    } catch (err: any) {
      console.error("[MEMBERSHIP_ERROR] Failed to resolve user memberships:", err);
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.name || "User",
          email: session.user.email || "",
          phone: "",
          avatar: "",
          role: "customer",
          roles: [], 
          membershipsResolved: false,
        });
      } else {
        setUser(null);
      }
    } finally {
      if (isInitialMountOrSignIn) {
        setLoading(false);
      }
    }
  }, []);

  // Fix #3: Lightweight re-check on portal change
  useEffect(() => {
    if (!user || !user.membershipsResolved) return;
    
    const currentPortal = getRequestedPortal() as Role;
    if (currentPortal !== lastRequestedPortal.current) {
      lastRequestedPortal.current = currentPortal;
      
      // If user already has this role in their list, just update UI 'role'
      if (user.roles.includes(currentPortal)) {
        setUser(prev => prev ? { ...prev, role: currentPortal, pendingPortal: currentPortal } : null);
        return;
      }

      // Otherwise, re-check portal access without global loading spinner
      (async () => {
        try {
          const { checkPortalAccess } = await import("./portal-authorization");
          if (["partner", "rider", "manager", "logistics"].includes(currentPortal)) {
            const access = await checkPortalAccess(user.email, currentPortal as any);
            if (access.ok) {
              setUser(prev => {
                if (!prev) return null;
                const newRoles = Array.from(new Set([...prev.roles, currentPortal]));
                return { ...prev, role: currentPortal, roles: newRoles, pendingPortal: currentPortal };
              });
            }
          }
        } catch (err) {
          console.error("[AUTH_DEBUG] Portal change re-check failed:", err);
        }
      })();
    }
  }, [user]);

  useEffect(() => {
    console.log("[AUTH_DEBUG] [CHECKPOINT: AUTH_STORE_MOUNT] Initializing auth listener");
    // Initial mount: use true for isInitialMountOrSignIn
    resolveUser(true);

    const unsubscribe = insforge.auth.onAuthStateChange((event: string) => {
      console.log(`[AUTH_DEBUG] Auth State Change: ${event}`);
      if (event === 'signedIn') {
        console.log("[AUTH_TRACE] Auth State Event: SIGNED_IN -> Resolving User");
        resolveUser(true); // Sign in: use true for isInitialMountOrSignIn
      } else if (event === 'tokenRefreshed') {
        console.log("[AUTH_TRACE] Auth State Event: TOKEN_REFRESHED -> Resolving User (background)");
        resolveUser(false); // Token refreshed: use false to avoid spinner/re-resolution
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