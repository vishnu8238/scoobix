import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scoobix — Crave it. Get it." },
      { name: "description", content: "Premium food delivery from the best restaurants near you." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { user, loading, cachedRole } = useAuth();
  const location = useRouterState({ select: (s) => s.location });


  useEffect(() => {
    if (loading) return;
    
    // Determine the intended destination. 
    // On the root path, we default to the current session's role home or /auth/login.
    const role = user?.role ?? cachedRole;
    if (role) {
      navigate({ to: ROLE_HOME[role] as never, replace: true });
    } else {
      navigate({ to: "/auth/login", replace: true });
    }
  }, [navigate, user, loading, cachedRole, location.pathname]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-black">
      <ScoobixMark size={64} className="animate-pulse" />
    </div>
  );
}
