import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

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
    // We only redirect once the authoritative session is resolved.
    if (loading) return;
    
    if (user) {
      const hasRole = (r: Role) => user.roles.includes(r);
      const portal = localStorage.getItem("scoobix_active_portal_v1") as Role | null;
      
      let target = "/app";
      
      // If we have a persisted portal preference and the user HAS that role, respect it.
      if (portal && hasRole(portal)) {
        target = ROLE_HOME[portal];
      } else {
        // Fallback to highest privilege
        if (hasRole("admin")) target = "/admin";
        else if (hasRole("manager")) target = "/manager";
        else if (hasRole("partner")) target = "/partner";
        else if (hasRole("rider")) target = "/rider";
      }

      console.log("[auth] Root redirect to target:", target, "for roles:", user.roles, "active portal:", portal);
      navigate({ to: target as never, replace: true });
    } else {
      console.log("[auth] Root redirect to login (no session).");
      navigate({ to: "/auth/login", replace: true });
    }
  }, [navigate, user, loading]);



  return (
    <div className="flex min-h-svh items-center justify-center bg-black">
      <ScoobixMark size={64} className="animate-pulse" />
    </div>
  );
}
