import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, ROLE_HOME } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

/**
 * Role-based access guard. If a signed-in user lands on a section that
 * doesn't match their role, redirect them to their home surface.
 * Anonymous viewers are allowed through so the demo / portal still works.
 */
export function RoleGuard({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && user.role !== allow) {
      navigate({ to: ROLE_HOME[user.role] as never, replace: true });
    }
  }, [user, loading, allow, navigate]);

  if (!loading && user && user.role !== allow) return null;
  return <>{children}</>;
}
