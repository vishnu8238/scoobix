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
  const { user, loading, cachedRole } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  const mismatched = !!user && user.role !== allow;

  useEffect(() => {
    if (loading) {
      // Known-wrong surface on a cold reload: leave immediately instead of
      // waiting for the profile round-trip.
      if (cachedRole && cachedRole !== allow) {
        navigate({ to: ROLE_HOME[cachedRole] as never, replace: true });
      }
      return;
    }
    if (!user) {
      // Never bounce auth screens back into themselves (that nests
      // ?redirect= params forever).
      const safeRedirect = href.startsWith("/auth") ? undefined : href;
      navigate({
        to: "/auth/login",
        search: { app: allow, ...(safeRedirect ? { redirect: safeRedirect } : {}) },
        replace: true,
      } as never);
      return;
    }
    if (user.role !== allow) {
      navigate({ to: ROLE_HOME[user.role] as never, replace: true });
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
