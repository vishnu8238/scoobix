import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, ROLE_HOME, ROLE_ONBOARDING } from "@/lib/auth-store";
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
      // Intentional Onboarding: Send to onboarding if they are trying to access a portal they don't have membership for.
      const onboarding = ROLE_ONBOARDING[allow];
      console.log(`[auth] Redirecting to onboarding for ${allow}: ${onboarding}`);
      navigate({
        to: onboarding as never,
        replace: true,
      });
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



  // If user resolution is definitely complete and the role is still missing, 
  // the useEffect above will trigger the redirect to onboarding.
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

  // If loading is done but user is missing, useEffect will redirect to login.
  // If loading is done and user is present but lacks role, useEffect will redirect to onboarding.
  // In the tiny gap before navigation commits, we show a clean state.
  if (!user || !user.roles.includes(allow)) {
    return null;
  }


  return <>{children}</>;
}
