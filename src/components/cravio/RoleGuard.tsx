import React, { ReactNode, useEffect } from "react";
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const portal = getRequestedPortal();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__LAST_ROLE_GUARD_PATH__ = pathname;
      console.log(`[AUTH_TRACE] RoleGuard Path: ${pathname}, User: ${user?.id}, Resolved: ${user?.membershipsResolved}, Portal: ${portal}, Loading: ${loading}, Roles: ${user?.roles?.join(",")}`);
    }
    
    // AUTH HYDRATION PROTECTION: 
    // Do NOT trigger any redirects if auth is still initializing.
    if (loading) return;
    


    // 1. Not logged in? Redirect to portal-specific login
    if (!user) {
      if (pathname === "/login" || pathname.includes("/onboarding")) return;
      
      const loginPath = `/login?portal=${portal}`;
      console.log("[AUTH_DEBUG] RoleGuard Redirecting to Login:", loginPath);
      navigate({ to: loginPath as any });
      return;
    }

    // 2. Wait for membership resolution before making any access decisions
    if (!user.membershipsResolved) return;

    // 3. Membership Check
    const allowedRoles = Array.isArray(allow) ? allow : allow ? [allow] : [];
    
    if (allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => user.roles.includes(role));
      
      if (!hasAccess) {
        if (portal === "logistics") {
          // If authoritative resolution finished and they don't have it, stay on login page with error.
          if (!pathname.includes("/login")) {
            console.log("[AUTH_DEBUG] RoleGuard: Logistics unauthorized, redirecting to login.");
            window.location.replace("/login?portal=logistics&error=unauthorized");
          }
        } else if (portal === "admin") {
          if (!pathname.includes("/login")) {
            console.log("[AUTH_DEBUG] RoleGuard: Admin unauthorized, redirecting to login.");
            window.location.replace("/login?portal=admin&error=unauthorized");
          }
        } else if (!pathname.includes("/login") && !pathname.includes("/onboarding")) {
           // Default fallback for other portals
           console.log("[AUTH_DEBUG] RoleGuard: No access, redirecting to login.");
           window.location.replace(`/login?portal=${portal}&error=unauthorized`);
        }
      }
    }
  }, [user, loading, portal, allow, navigate, pathname]);

  if (loading) {
    // If we are already on a login page, just show it.
    if (pathname.includes("/login")) {
      return <>{children}</>;
    }
    
    // Otherwise, show the loading spinner but keep the layout space occupied
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            Authenticating...
          </p>
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
