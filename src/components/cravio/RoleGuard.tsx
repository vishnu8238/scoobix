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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  const mismatched = !!user && user.role !== allow;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/login", search: { app: allow, redirect: href }, replace: true } as never);
      return;
    }
    if (user.role !== allow) {
      navigate({ to: ROLE_HOME[user.role] as never, replace: true });
    }
  }, [user, loading, allow, navigate, href]);

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
