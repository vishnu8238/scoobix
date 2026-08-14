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
  membershipsResolved: boolean;
  pendingPortal?: Role;
};

export type AuthState = 
  | "initializing" 
  | "oauth_callback_in_progress" 
  | "session_resolving" 
  | "authenticated" 
  | "unauthenticated" 
  | "authorization_resolving" 
  | "denied"
  | "disabled"
  | "auth_error";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  authState: AuthState;
  authError: string | null;
  login: (provider: 'google', portal?: string, options?: { prompt?: 'select_account' | 'consent' | 'none' }) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  authState: "initializing",
  authError: null,
  login: async () => {},
  logout: async () => {},
  signOut: async () => {},
});

export const getRequestedPortal = () => {
  if (typeof window === "undefined") return "customer";
  const params = new URLSearchParams(window.location.search);
  const portalParam = params.get("portal");
  if (portalParam) return portalParam as Role;
  
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
  const [authState, setAuthState] = useState<AuthState>("initializing");
  const [authError, setAuthError] = useState<string | null>(null);
  const lastRequestedPortal = useRef<Role | null>(null);

  const resolveUser = useCallback(async (isInitialMountOrSignIn: boolean = false) => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setAuthState((prev) => (prev === "session_resolving" || prev === "authorization_resolving" ? "auth_error" : prev));
      setAuthError((prev) => prev || "Authentication timed out. Please try again.");
    }, 20000);

    try {
      if (isInitialMountOrSignIn) {
        setLoading(true);
        setAuthState("session_resolving");
        setAuthError(null);
      }
      
      const { data: userData, error: currentUserError } = await insforge.auth.getCurrentUser().catch(e => ({ data: null, error: e }));
      
      if (currentUserError || !userData?.user) {
         setUser(null);
         setAuthState("unauthenticated");
         return;
      }
      
      const sessionUser = userData.user;
      const authId = sessionUser.id;
      
      const { setCacheAuthScope } = await import("./request-cache");
      setCacheAuthScope(authId);

      setAuthState("authorization_resolving");
      const currentPortal = getRequestedPortal() as Role;
      lastRequestedPortal.current = currentPortal;

      let profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 }).catch(() => []);
      let profile = profiles[0];

      if (!profile) {
        try {
          const { createRecord } = await import("./insforge-crud");
          profile = await createRecord("users", {
            id: authId,
            email: sessionUser.email,
            email_normalized: sessionUser.email.toLowerCase(),
            name: sessionUser.name || "User",
            role: "customer",
            is_active: true,
          });
        } catch (err) {
          console.error("[AUTH_ERROR] Profile creation failed:", err);
        }
      }

      const roles: Role[] = ["customer"];
      const { checkPortalAccess } = await import("./portal-authorization");
      
      const SUPER_ADMIN = "scoobix.info@gmail.com";
      const userEmail = sessionUser.email?.toLowerCase();
      const isSuperAdmin = userEmail === SUPER_ADMIN || profile?.role === "admin";

      if (isSuperAdmin) {
        roles.push("admin", "logistics", "partner", "rider", "manager");
      } else if (userEmail) {
        const otherPortals: Role[] = ["partner", "rider", "manager", "logistics", "admin"];
        const results = await Promise.all(
          otherPortals.map(async (p) => {
            const access = await checkPortalAccess(userEmail, p as any).catch(() => ({ ok: false }));
            return access.ok ? p : null;
          })
        );
        results.forEach(r => { if (r) roles.push(r); });
      }

      if (profile?.id) {
        const [partner, rider, manager] = await Promise.all([
          listTable("restaurants", { owner_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
          listTable("drivers", { user_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
          listTable("merchant_managers", { user_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
        ]);
        if (partner.length > 0 && !roles.includes("partner")) roles.push("partner");
        if (rider.length > 0 && !roles.includes("rider")) roles.push("rider");
        if (manager.length > 0 && !roles.includes("manager")) roles.push("manager");
      }

      const hasAccess = currentPortal === "customer" || roles.includes(currentPortal);
      
      setUser({
        id: authId,
        name: profile?.name || sessionUser.name || "User",
        email: sessionUser.email || "",
        phone: profile?.phone || "",
        avatar: profile?.avatar_url || sessionUser.avatar_url || "",
        role: hasAccess ? currentPortal : "customer",
        roles: Array.from(new Set(roles)),
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });

      if (!hasAccess && currentPortal !== "customer") {
        const access = await checkPortalAccess(userEmail, currentPortal as any).catch(() => ({ ok: false, reason: "denied" }));
        setAuthState(access.reason === "disabled" ? "disabled" : "denied");
      } else {
        setAuthState("authenticated");
      }
    } catch (err: any) {
      console.error("[AUTH_CRITICAL]", err);
      setAuthError(err.message || "Failed to resolve permissions.");
      setAuthState("auth_error");
    } finally {
      clearTimeout(timeoutId);
      if (isInitialMountOrSignIn) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !user.membershipsResolved) return;
    const currentPortal = getRequestedPortal() as Role;
    if (currentPortal !== lastRequestedPortal.current) {
      lastRequestedPortal.current = currentPortal;
      if (user.roles.includes(currentPortal)) {
        setUser(prev => prev ? { ...prev, role: currentPortal } : null);
      } else if (currentPortal !== "customer") {
        resolveUser(false);
      }
    }
  }, [user, resolveUser]);

  useEffect(() => {
    resolveUser(true);
    const unsubscribe = insforge.auth.onAuthStateChange((event: string) => {
      if (event === 'signedIn') resolveUser(true);
      else if (event === 'signedOut') {
        setUser(null);
        setAuthState("unauthenticated");
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [resolveUser]);

  const login = async (provider: 'google', portal: string = "customer", options: { prompt?: 'select_account' | 'consent' | 'none' } = {}) => {
    if (provider === 'google') await loginWithGoogle(portal, options);
  };

  const logout = async () => {
    const portal = getRequestedPortal();
    await ifLogout();
    setUser(null);
    setAuthState("unauthenticated");
    window.location.replace(new URL(portal === "customer" ? "/" : `/login?portal=${portal}`, window.location.origin).href);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, authState, authError, login, logout, signOut: logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
