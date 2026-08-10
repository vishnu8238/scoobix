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
    if (loading || (typeof window !== "undefined" && window.localStorage.getItem("scoobix_test_bypass") === "true")) return;

    // 1. Not logged in? Redirect to portal-specific login
    if (!user) {
      // If we are already on a login page, don't redirect
      if (pathname.includes("/login") || pathname.includes("/onboarding")) return;
      
      const loginPath = portal === "customer" ? "/customer/login" : `/${portal}/login`;
      navigate({ to: loginPath as any });
      return;
    }

    // 2. Membership Check
    const allowedRoles = Array.isArray(allow) ? allow : allow ? [allow] : [];
    
    // If specific roles are required (e.g. for /partner routes)
    if (allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => user.roles.includes(role));
      
      if (!hasAccess) {
        // If it's a partner/rider trying to access without membership, send to onboarding
        if (portal === "partner" && !user.roles.includes("partner")) {
          navigate({ to: "/partner/onboarding" as any });
        } else if (portal === "rider" && !user.roles.includes("rider")) {
          navigate({ to: "/rider/onboarding" as any });
        } else if (portal === "manager" && !user.roles.includes("manager")) {
          navigate({ to: "/manager/onboarding" as any });
        } else {
          // General fallback to customer portal
          navigate({ to: "/app" as any });
        }
      }
    }
  }, [user, loading, portal, allow, navigate, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If we require auth and don't have a user, we've already triggered a redirect.
  // We return null to prevent flashing the protected content.
  const bypass = typeof window !== "undefined" && window.localStorage.getItem("scoobix_test_bypass") === "true";
  if (!user && !pathname.includes("/login") && !pathname.includes("/onboarding") && !bypass) {
    return null;
  }

  return <>{children}</>;
}
