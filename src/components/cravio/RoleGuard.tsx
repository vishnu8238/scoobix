import React, { ReactNode, useEffect, useState } from "react";
import { useAuth, Role, getRequestedPortal } from "@/lib/auth-store";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * SCOOBIX — ROLE GUARD
 * Validates authentication and portal membership.
 */

interface RoleGuardProps {
  allow?: Role | Role[];
  children: ReactNode;
  loading?: ReactNode;
  fallback?: ReactNode;
  transitionLabel?: string;
}

export function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
  const { user, loading, authState } = useAuth();
  const navigate = useNavigate();
  const portal = getRequestedPortal();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || authState === "initializing" || authState === "session_resolving" || authState === "authorization_resolving") {
        setTimedOut(true);
      }
    }, 15000);

    if (typeof window !== 'undefined') {
      (window as any).__LAST_ROLE_GUARD_PATH__ = pathname;
      console.log(`[AUTH_TRACE] RoleGuard Path: ${pathname}, User: ${user?.id}, Resolved: ${user?.membershipsResolved}, Portal: ${portal}, State: ${authState}, Loading: ${loading}, Roles: ${user?.roles?.join(",")}`);
    }

    return () => clearTimeout(timer);
  }, [pathname, user, loading, authState, portal]);

  useEffect(() => {
    
    // AUTH HYDRATION PROTECTION: 
    // Do NOT trigger any redirects if auth is still initializing or resolving.
    if (loading || authState === "initializing" || authState === "session_resolving" || authState === "authorization_resolving") return;
    
    // 1. Not logged in? 
    if (!user) {
      if (pathname === "/login" || pathname.includes("/onboarding") || pathname.includes("/auth/callback")) return;
      
      // If we are strictly unauthenticated (no session), go to login
      const loginPath = `/login?portal=${portal}`;
      console.log("[AUTH_DEBUG] RoleGuard: Unauthenticated, redirecting to login:", loginPath);
      window.location.replace(new URL(loginPath, window.location.origin).href);
      return;
    }

    // 2. Wait for membership resolution before making any access decisions
    if (!user.membershipsResolved) return;

    // 3. Membership Check
    const allowedRoles = Array.isArray(allow) ? allow : allow ? [allow] : [];
    
    if (allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => user.roles.includes(role));
      
      if (!hasAccess) {
        if (!pathname.includes("/login") && !pathname.includes("/onboarding")) {
           console.log(`[AUTH_DEBUG] RoleGuard: ${portal} unauthorized for user ${user.email}. Redirecting.`);
           window.location.replace(`/login?portal=${portal}&denied=${portal}`);
        }
      }
    }
  }, [user, loading, portal, allow, navigate, pathname]);

  if (loading || authState === "initializing" || authState === "session_resolving" || authState === "authorization_resolving") {
    // If we are already on a login page, just show it.
    if (pathname.includes("/login")) {
      return <>{children}</>;
    }
    
    // Otherwise, show the loading spinner but keep the layout space occupied
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {timedOut ? (
            <div className="text-center space-y-4 animate-fade-up">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-xs text-destructive font-medium uppercase tracking-widest">Connection Timeout</p>
                <p className="text-[10px] text-muted-foreground mt-1">Verification is taking longer than expected.</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                Authenticating...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // If not logged in and not on login/onboarding, we've triggered a redirect.
  if (!user && !pathname.includes("/login") && !pathname.includes("/onboarding")) {
    return <div className="min-h-svh bg-background" />;
  }

  return <>{children}</>;
}