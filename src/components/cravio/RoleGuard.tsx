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
    console.log(`[AUTH_DEBUG] RoleGuard Path: ${pathname}, User: ${user?.id}, Resolved: ${user?.membershipsResolved}, Portal: ${portal}, Loading: ${loading}, Roles: ${user?.roles?.join(",")}`);
    if (loading) return;
    


    // 1. Not logged in? Redirect to portal-specific login
    if (!user) {
      if (pathname.includes("/login") || pathname.includes("/onboarding")) return;
      
      const loginPath = portal === "customer" ? "/customer/login" : `/${portal}/login`;
      navigate({ to: loginPath as any });
      return;
    }

    // 2. Wait for membership resolution before making any access decisions
    // This prevents a temporary "customer" role from triggering a redirect to /app
    if (!user.membershipsResolved) return;

    // 3. Membership Check
    const allowedRoles = Array.isArray(allow) ? allow : allow ? [allow] : [];
    
    if (allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => user.roles.includes(role));
      
      if (!hasAccess) {
        // Redirect to portal-specific admission/onboarding if roles are missing
        if (portal === "partner" && !user.roles.includes("partner")) {
          // Admission to /partner is granted to authenticated users; onboarding is a choice.
          // We do NOT redirect to /partner/onboarding here.
        } else if (portal === "rider" && !user.roles.includes("rider")) {
          // Admission to /rider is granted to authenticated users; onboarding is a choice.
          // We do NOT redirect to /rider/onboarding here.
        } else if (portal === "manager" && !user.roles.includes("manager")) {
          // If the user is logged in and resolution finished, but they STILL don't have the manager role,
          // we stay on /manager and let the component handle the unauthorized/loading state.
          // This avoids the silent /app fallback.
        } else {
          // Default to customer app only if authoritative resolution shows they are just a customer
          navigate({ to: "/app" as any });
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
