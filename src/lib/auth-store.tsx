import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { loginWithGoogle, logout as ifLogout } from "./insforge-auth";
import { insforge, getAccessToken } from "./insforge";
import { listTable } from "./insforge-crud";
import { getDisplayName } from "./identity-utils";

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
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const loadingStartTime = useRef<number>(Date.now());
  const lastRequestedPortal = useRef<Role | null>(null);

  const resolveUser = useCallback(async (isInitialMountOrSignIn: boolean = false) => {
    const timeoutId = setTimeout(() => {
      console.error("[AUTH_WATCHDOG] Auth resolution timed out after 15s");
      setLoading(false);
      setAuthState((prev) => (prev === "session_resolving" || prev === "authorization_resolving" || prev === "initializing" ? "auth_error" : prev));
      setAuthError((prev) => prev || "Authentication connection timed out. Please check your internet and try again.");
    }, 15000);

    try {
      if (isInitialMountOrSignIn) {
        setLoading(true);
        setAuthState("session_resolving");
        setAuthError(null);
      }
      
      console.log("[AUTH_TRACE] Resolving user session...");
      
      // Ensure the SDK has had a moment to hydrate from storage
      if (typeof window !== "undefined") {
        const { ensureAuthHydrated } = await import("./insforge");
        await ensureAuthHydrated();
      }

      const { data: userData, error: currentUserError } = await insforge.auth.getCurrentUser().catch((e: any) => ({ data: null, error: e }));
      
      if (currentUserError || !userData?.user) {
         const errorMsg = currentUserError?.message || "";
         console.log("[AUTH_TRACE] No active session found.", errorMsg);
         
         // iOS Safeguard: Clear storage on definitive refresh/session failures
         const isRefreshError = errorMsg.includes("refresh token") || 
                               errorMsg.includes("session_not_found") ||
                               errorMsg.includes("invalid_grant");

         if (isRefreshError) {
           console.warn("[AUTH_TRACE] Refresh token invalid/missing. Clearing session.");
           // We don't call signOut() here because it might attempt a network request that fails,
           // instead we manually clear known SDK storage keys and local session flags.
           if (typeof window !== "undefined") {
             localStorage.removeItem('scoobix_auth_token');
             // Clear all InsForge related storage to ensure a clean slate
             for (let i = 0; i < localStorage.length; i++) {
               const key = localStorage.key(i);
               if (key && (key.includes('insforge') || (key.startsWith('sb-') && key.endsWith('-code-verifier')))) {
                 localStorage.removeItem(key);
               }
             }
           }
         }
         
         setUser(null);
         setAuthState("unauthenticated");
         return;
      }
      
      const sessionUser = userData.user;
      const authId = sessionUser.id;
      const userEmail = sessionUser.email?.toLowerCase().trim();
      
      console.log("[AUTH_TRACE] Session found for:", userEmail);
      
      const { setCacheAuthScope } = await import("./request-cache");
      setCacheAuthScope(authId);

      setAuthState("authorization_resolving");
      const currentPortal = getRequestedPortal() as Role;
      lastRequestedPortal.current = currentPortal;

      // 1. User Profile Lookup/Creation
      let profile = null;
      try {
        const profiles = await listTable<any>("users", { id: `eq.${authId}`, limit: 1 }, { fresh: true, ttl: 0, select: "id,name,role,email,phone,avatar_url,full_name,display_name" }).catch(() => []);
        profile = profiles[0];

        // Authoritative Merged Object for Identity Resolution
        const combinedUserData = { 
          ...sessionUser, 
          profile: profile, // Database profile
          user_metadata: sessionUser.user_metadata,
          identities: sessionUser.identities,
        };
        const sessionNameCandidate = getDisplayName(combinedUserData);
        console.log(`[AUTH_TRACE] Identity Source Probe: ID=${authId} Email=${userEmail} ResolvedName="${sessionNameCandidate}" MetadataExists=${!!sessionUser.user_metadata} IdentitiesCount=${sessionUser.identities?.length || 0}`);
        
        if (typeof window !== "undefined") {
          (window as any).__LAST_RESOLVED_NAME = sessionNameCandidate;
          (window as any).__AUTH_USER_DATA = JSON.parse(JSON.stringify(combinedUserData));
        }

        if (!profile && userEmail) {
          console.log("[AUTH_TRACE] Creating new profile for:", userEmail);
          const { createRecord } = await import("./insforge-crud");
          profile = await createRecord("users", {
            id: authId,
            email: userEmail,
            email_normalized: userEmail,
            name: (sessionNameCandidate && sessionNameCandidate !== "User") ? sessionNameCandidate : null,
            role: "customer",
            is_active: true,
          });
        } else if (profile && sessionNameCandidate !== "User" && profile.name !== sessionNameCandidate) {
          // Sync DB name if OAuth/Metadata is higher quality than stale DB name
          console.log("[AUTH_TRACE] Syncing profile name from", profile.name, "to", sessionNameCandidate);
          const { patchRecord } = await import("./insforge-crud");
          await patchRecord("users", authId, { name: sessionNameCandidate }).catch(e => 
            console.warn("[AUTH_TRACE] Profile sync skipped:", e.message)
          );
        }
      } catch (err) {
        console.error("[AUTH_TRACE] Profile resolution failed:", err);
      }

      // 2. Roles Resolution
      const roles: Role[] = ["customer"];
      const { checkPortalAccess } = await import("./portal-authorization");
      
      const SUPER_ADMINS = ["scoobix.info@gmail.com"];
      const isSuperAdmin = SUPER_ADMINS.includes(userEmail) || profile?.role === "admin";

      if (isSuperAdmin) {
        console.log("[AUTH_TRACE] Super Admin access granted.");
        roles.push("admin", "logistics", "partner", "rider", "manager");
      } else if (userEmail) {
        console.log("[AUTH_TRACE] Checking portal access for:", userEmail);
        const otherPortals: Role[] = ["partner", "rider", "manager", "logistics", "admin"];
        const results = await Promise.all(
          otherPortals.map(async (p) => {
            try {
              const access = await checkPortalAccess(userEmail, p as any);
              if (access.ok) console.log(`[AUTH_TRACE] Access GRANTED for ${p}`);
              return access.ok ? p : null;
            } catch (e) {
              console.warn(`[AUTH_TRACE] Access check failed for ${p}:`, e);
              return null;
            }
          })
        );
        results.forEach(r => { if (r) roles.push(r); });
      }

      // 3. Legacy Table Checks (Backwards compatibility)
      if (profile?.id) {
        try {
          const [partner, rider, manager] = await Promise.all([
            listTable("restaurants", { owner_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
            listTable("drivers", { user_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
            listTable("merchant_managers", { user_id: `eq.${profile.id}`, limit: 1 }).catch(() => []),
          ]);
          if (partner.length > 0 && !roles.includes("partner")) roles.push("partner");
          if (rider.length > 0 && !roles.includes("rider")) roles.push("rider");
          if (manager.length > 0 && !roles.includes("manager")) roles.push("manager");
        } catch (err) {
          console.warn("[AUTH_TRACE] Legacy role check failed:", err);
        }
      }

      const uniqueRoles = Array.from(new Set(roles));
      const hasAccess = currentPortal === "customer" || uniqueRoles.includes(currentPortal);
      
      console.log("[AUTH_TRACE] Final Roles:", uniqueRoles, "Current Portal:", currentPortal, "Has Access:", hasAccess);

      const displayName = getDisplayName({ 
        ...sessionUser, 
        profile: profile,
        user_metadata: sessionUser.user_metadata, 
        identities: sessionUser.identities,
      });

      console.log("[AUTH_TRACE] Final Resolved Name:", displayName);

      setUser({
        id: authId,
        name: displayName,
        email: userEmail || "",
        phone: profile?.phone || "",
        avatar: profile?.avatar_url || sessionUser.avatar_url || "",
        role: hasAccess ? currentPortal : "customer",
        roles: uniqueRoles,
        membershipsResolved: true,
        pendingPortal: currentPortal,
      });

      if (!hasAccess && (currentPortal as string) !== "customer") {
        console.warn("[AUTH_TRACE] Access denied to portal:", currentPortal);
        const access = await checkPortalAccess(userEmail, currentPortal as any).catch((e) => ({ ok: false, reason: "lookup_failed", message: e.message }));
        if ((access as any).reason === "lookup_failed") {
          setAuthState("auth_error");
          setAuthError((access as any).message || "Database lookup failed during authorization.");
        } else {
          setAuthState((access as any).reason === "disabled" ? "disabled" : "denied");
        }
      } else {
        setAuthState("authenticated");
      }
    } catch (err: any) {
      console.error("[AUTH_CRITICAL]", err);
      setAuthError(err.message || "Failed to resolve permissions.");
      setAuthState("auth_error");
    } finally {
      clearTimeout(timeoutId);
      if (isInitialMountOrSignIn) {
        setLoading(false);
        setHydrationComplete(true);
      }
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
    
    // Explicitly check for insforge_code in the URL to detect if we're in a callback loop
    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has("insforge_code") || params.has("code");
    
    const unsubscribe = insforge.auth.onAuthStateChange((event: string) => {
      console.log(`[AUTH_TRACE] SDK State Change: ${event}`);
      if (event === 'signedIn' || event === 'TOKEN_REFRESHED') {
        resolveUser(true);
      } else if (event === 'signedOut') {
        setUser(null);
        setAuthState("unauthenticated");
        setLoading(false);
        setHydrationComplete(true);
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
      user, loading, authState, authError, hydrationComplete, login, logout, signOut: logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
