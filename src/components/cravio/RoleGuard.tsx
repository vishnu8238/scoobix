import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, ROLE_ONBOARDING, ROLE_HOME } from "@/lib/auth-store";
import type { Role } from "@/lib/types";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";

/**
 * Hard role isolation.
 *
 * - Anonymous visitors are sent to the sign-in screen for this app.
 * - Signed-in users whose role does not own this surface are redirected to
 *   onboarding for THAT portal (intent preservation).
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
    
    if (user) {
      // 1. Check if user has membership for THIS portal
      if (!user.roles.includes(allow)) {
        const onboarding = ROLE_ONBOARDING[allow];
        console.warn(`[AUTH_ADMISSION] RoleGuard: User lacks membership for ${allow}. Redirecting to ${onboarding}`);
        // Avoid redundant navigations if already there
        if (!window.location.pathname.startsWith(onboarding)) {
          navigate({ to: onboarding as any, replace: true });
        }
        return;
      }
      
      // 2. User is authorized for this portal.
      // If they are on a generic /auth path, move them to the portal home.
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/auth")) {
        const home = ROLE_HOME[allow];
        console.log(`[AUTH_ADMISSION] RoleGuard: Authorized on auth path. Moving to ${home}`);
        navigate({ to: home as any, replace: true });
      }
    } else {
      // 3. Not authenticated.
      const safeRedirect = href.startsWith("/auth") || href.includes("login") ? undefined : href;
      console.log(`[AUTH_ADMISSION] RoleGuard: Unauthenticated. Redirecting to login for portal ${allow}`);
      navigate({
        to: "/auth/login",
        search: { app: allow, ...(safeRedirect ? { redirect: safeRedirect } : {}) },
        replace: true,
      } as any);
    }
  }, [user, loading, allow, navigate, href]);

  // We only show the logo while authenticating or loading memberships.
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse-soft flex flex-col items-center gap-4">
          <ScoobixMark size={56} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            Verifying Identity...
          </p>
        </div>
      </div>
    );
  }

  // If loading is done but user is missing or unauthorized, we show a transition state
  // while the useEffect above handles the redirect.
  if (!user || !user.roles.includes(allow)) {
    if (user) {
      return (
        <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 text-center">
          <div className="max-w-xs space-y-4">
            <ScoobixMark size={48} className="mx-auto" />
            <h2 className="font-display text-xl font-bold">Accessing {allow} portal...</h2>
            <p className="text-sm text-muted-foreground">Please wait while we set up your account.</p>
          </div>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}
