import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, ROLE_HOME } from "@/lib/auth-store";
import type { Role } from "@/lib/types";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";

/**
 * Hard role isolation.
 *
 * - Anonymous visitors are sent to the sign-in screen for this app.
 * - Signed-in users whose role does not own this surface are redirected to
 *   their own application home. There is no manual portal switching.
 */
export function RoleGuard({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { user, loading, cachedRole, setPortal } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  // Update active portal when entering a guarded area.
  useEffect(() => {
    setPortal(allow);
  }, [allow, setPortal]);

  const mismatched = !!user && user.role !== allow;

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      // Send to the login screen for this app.
      const safeRedirect = href.startsWith("/auth") || href.includes("login") ? undefined : href;
      navigate({
        to: "/auth/login",
        search: { app: allow, ...(safeRedirect ? { redirect: safeRedirect } : {}) },
        replace: true,
      } as never);
      return;
    }
    
    // Authorization check: If the user has a session but the wrong role for this portal.
    if (user.role !== allow) {
      // The user is authenticated but doesn't have the right role for this portal.
      // We don't automatically redirect them to their home; the Login page 
      // will handle the "Wrong Account" flow if they landed there from a link.
      // However, if they are already inside the app tree, we must enforce the role.
      navigate({
        to: "/auth/login",
        search: { app: allow, redirect: href },
        replace: true,
      } as never);
    }
  }, [user, loading, allow, navigate, href, cachedRole]);


  if (loading || !user || mismatched) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse-soft">
          <ScoobixMark size={56} />
        </div>
      </div>
    );
  }


  return <>{children}</>;
}
