import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, ROLE_ONBOARDING, ROLE_HOME, getRequestedPortal } from "@/lib/auth-store";
import type { Role } from "@/lib/types";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";

/**
 * Hard role isolation.
 *
 * - Anonymous visitors are sent to the sign-in screen for this app.
 * - Signed-in users whose role does not own this surface are redirected to
 *   onboarding for THAT portal (intent preservation).
 */
export function RoleGuard({ 
  allow, 
  children,
  transitionLabel
}: { 
  allow: Role; 
  children: React.ReactNode;
  transitionLabel?: string;
}) {
  const { user, loading, authState, authError } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    if (loading || authState === "RESOLVING") return;
    
    if (!user) {
      const intent = getRequestedPortal(window.location.pathname) || allow;
      const search: any = { app: intent };
      if (href !== "/auth/login" && !href.includes("/auth")) {
        search.redirect = href;
      }
      navigate({
        to: "/auth/login",
        search,
        replace: true,
      } as any);
      return;
    }

    if (!user.roles.includes(allow)) {
      const onboarding = ROLE_ONBOARDING[allow];
      if (onboarding && window.location.pathname !== onboarding) {
        window.location.assign(onboarding);
      } else if (!onboarding) {
        navigate({ to: ROLE_HOME.customer as any, replace: true });
      }
    }
  }, [user, loading, authState, allow, navigate, href]);


  // We only show the logo while authenticating or loading memberships.
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-background">
        <div className="animate-pulse-soft flex flex-col items-center gap-4">
          <ScoobixMark size={56} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            {transitionLabel || "Verifying Identity..."}
          </p>
        </div>
      </div>
    );
  }

  // If loading is done but user is missing or unauthorized, we show a transition state
  // while the useEffect above handles the redirect.
  if (!user || !user.roles.includes(allow)) {
    if (authState === "ERROR") {
      return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-6 text-center">
          <ScoobixMark size={48} className="mb-4" />
          <h2 className="font-display text-xl font-bold text-destructive">Authentication Error</h2>
          <p className="mt-2 text-sm text-muted-foreground">{authError || "An unexpected error occurred during admission."}</p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => window.location.assign("/auth/login")}>
            Back to Login
          </Button>
        </div>
      );
    }

    if (user) {
      return (
        <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 text-center">
          <div className="max-w-xs space-y-4">
            <ScoobixMark size={48} className="mx-auto" />
            <h2 className="font-display text-xl font-bold">{transitionLabel || `Accessing ${allow} portal...`}</h2>
            <p className="text-sm text-muted-foreground">Please wait while we verify your account status.</p>
          </div>
        </div>
      );
    }
    return null;
  }


  return <>{children}</>;
}
