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
  const { user, loading, setPortal } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  // Inform the provider of the required portal for this route tree.
  useEffect(() => {
    setPortal(allow);
  }, [allow, setPortal]);

  useEffect(() => {
    if (loading) return;
    
    // Authorization check: session exists but the required role is missing from the user's role list.
    if (user && !user.roles.includes(allow)) {
      console.warn(`[auth] RoleGuard mismatch: user has roles [${user.roles.join(", ")}] but portal requires ${allow}`);
      // Send to the login screen specifically for THIS portal so the user can sign in with the right account or resolve access.
      navigate({
        to: "/auth/login",
        search: { app: allow, redirect: href },
        replace: true,
      } as never);
      return;
    }

    // Authentication check: no session.
    if (!user) {
      const safeRedirect = href.startsWith("/auth") || href.includes("login") ? undefined : href;
      navigate({
        to: "/auth/login",
        search: { app: allow, ...(safeRedirect ? { redirect: safeRedirect } : {}) },
        replace: true,
      } as never);
    }
  }, [user, loading, allow, navigate, href]);



  if (loading || !user || !user.roles.includes(allow)) {
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
