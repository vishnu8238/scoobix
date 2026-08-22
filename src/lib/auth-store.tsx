import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { loginWithGoogle, logout as ifLogout } from "./insforge-auth";
import { insforge, ensureAuthHydrated } from "./insforge";
import { listTable } from "./insforge-crud";
import { getDisplayName } from "./identity-utils";
import { isAuthResolving } from "./auth-utils";
import { setCacheAuthScope } from "./request-cache";

export type Role = "customer" | "partner" | "rider" | "admin" | "manager" | "logistics" | "dispatcher" | "zone_manager" | "logistics_admin";

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
  hydrationComplete: boolean;
  login: (provider: 'google', portal?: string, options?: { prompt?: 'select_account' | 'consent' | 'none' }) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  authState: "initializing",
  authError: null,
  hydrationComplete: false,
  login: async () => {},
  logout: async () => {},
  signOut: async () => {},
});

export const getRequestedPortal = (): Role => {
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

/**
 * P0.1: Authoritative Identity Resolution
 */
function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>("initializing");
  const [authError, setAuthError] = useState<string | null>(null);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  
  const lastPortalRef = useRef<Role | null>(null);
  const resolutionActiveRef = useRef<boolean>(false);

  const resolveUser = useCallback(async (isInitial: boolean = false) => {
    if (resolutionActiveRef.current) return;
    resolutionActiveRef.current = true;

    try {
      if (isInitial) {
        setAuthState("initializing");
        setLoading(true);
      }
      
      // Authoritative Auth Hydration (P0.1)
      const hydratedUser = await ensureAuthHydrated();
      const sdkUser = insforge.auth.session?.user;
      const sessionUser = sdkUser || hydratedUser;

      if (!sessionUser) {
        setUser(null);
        setAuthState("unauthenticated");
        setCacheAuthScope(null);
        return;
      }

      const authId = sessionUser.id;
      const userEmail = normalizeEmail(sessionUser.email);
      setCacheAuthScope(authId);
      
      setAuthState("authorization_resolving");
      const currentPortal = getRequestedPortal();
      lastPortalRef.current = currentPortal;

      // 1. Profile Sync
      let profile = null;
      try {
        const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 }, { fresh: true, ttl: 0 });
        profile = profiles[0];
        
        if (!profile && userEmail) {
          const { createRecord } = await import("./insforge-crud");
          profile = await createRecord("users", {
            id: authId,
            email: userEmail,
            role: "customer",
            is_active: true,
          });
        }
      } catch (e: any) {
        // P0.1: If unauthenticated or permission denied during profile sync, exit gracefully
        if (e?.isAuthError || e?.insforge_status === 401 || e?.insforge_status === 403) {
          console.warn("[AUTH_TRACE] Profile resolution stopped (Unauthenticated).");
          setUser(null);
          setAuthState("unauthenticated");
          setCacheAuthScope(null);
          resolutionActiveRef.current = false;
          if (isInitial) {
            setLoading(false);
            setHydrationComplete(true);
          }
          return;
        }
        console.warn("[AUTH_TRACE] Profile resolution failed:", e);
      }

      // 2. Authoritative Portal Access (P0.1: Exclusive mechanism)
      const roles: Role[] = ["customer"];
      const { checkPortalAccess } = await import("./portal-authorization");

      if (userEmail) {
        const otherPortals: Role[] = ["partner", "rider", "manager", "logistics", "admin"];
        const results = await Promise.all(
          otherPortals.map(p => checkPortalAccess(userEmail, p as any).catch(() => ({ ok: false })))
        );
        results.forEach((res, i) => {
          if (res.ok) roles.push(otherPortals[i]);
        });
      }

      const uniqueRoles = Array.from(new Set(roles));
      const hasAccess = currentPortal === "customer" || uniqueRoles.includes(currentPortal);
      
      const displayName = getDisplayName({ ...sessionUser, profile });

      setUser({
        id: authId,
        name: displayName,
        email: userEmail,
        phone: profile?.phone || "",
        avatar: profile?.avatar_url || sessionUser.avatar_url || "",
        role: hasAccess ? currentPortal : "customer",
        roles: uniqueRoles,
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });

      if (!hasAccess && (currentPortal as string) !== "customer") {
        setAuthState("denied");
      } else {
        setAuthState("authenticated");
      }
    } catch (err: any) {
      console.error("[AUTH_CRITICAL]", err);
      setAuthError(err.message || "Failed to resolve permissions.");
      setAuthState("auth_error");
    } finally {
      resolutionActiveRef.current = false;
      if (isInitial) {
        setLoading(false);
        setHydrationComplete(true);
      }
    }
  }, []);

  useEffect(() => {
    resolveUser(true);

    const unsubscribe = insforge.auth.onAuthStateChange((event: string, session?: any) => {
      console.log(`[AUTH_TRACE] SDK State Change: ${event}`);
      if (event === 'signedIn' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        resolveUser(false);
      } else if (event === 'signedOut') {
        setUser(null);
        setAuthState("unauthenticated");
        setLoading(false);
        setHydrationComplete(true);
        setCacheAuthScope(null);
      }
    });
    
    return () => unsubscribe();
  }, [resolveUser]);

  // Handle portal changes within a session
  useEffect(() => {
    if (!user?.membershipsResolved) return;
    const currentPortal = getRequestedPortal();
    if (currentPortal !== lastPortalRef.current) {
      lastPortalRef.current = currentPortal;
      if (user.roles.includes(currentPortal)) {
        setUser(prev => prev ? { ...prev, role: currentPortal } : null);
        setAuthState("authenticated");
      } else if ((currentPortal as string) !== "customer") {
        setAuthState("denied");
      }
    }
  }, [user]);

  const login = async (provider: 'google', portal: string = "customer", options: { prompt?: 'select_account' | 'consent' | 'none' } = {}) => {
    if (provider === 'google') {
      setAuthState("oauth_callback_in_progress");
      await loginWithGoogle(portal, options);
    }
  };

  const logout = async () => {
    const portal = getRequestedPortal();
    try {
      await ifLogout();
    } finally {
      setUser(null);
      setAuthState("unauthenticated");
      setCacheAuthScope(null);
      const dest = (portal as string) === "customer" ? "/" : `/login?portal=${portal}`;
      window.location.replace(new URL(dest, window.location.origin).href);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, authState, authError, hydrationComplete, login, logout, signOut: logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
