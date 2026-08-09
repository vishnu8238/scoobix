import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME, resolvePortalFromPath } from "@/lib/auth-store";
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
      // AUTHORITATIVE: The URL path determines the portal we land in.
      const portal = resolvePortalFromPath(window.location.pathname);
      
      let target = "/app";
      
      if (portal && hasRole(portal)) {
        target = ROLE_HOME[portal];
      } else if (hasRole("admin")) {
        target = ROLE_HOME.admin;
      } else if (hasRole("manager")) {
        target = ROLE_HOME.manager;
      } else if (hasRole("partner")) {
        target = ROLE_HOME.partner;
      } else if (hasRole("rider")) {
        target = ROLE_HOME.rider;
      } else {
        target = ROLE_HOME.customer;
      }

      console.log("[auth] Splash redirecting to target:", target, "requested portal:", portal);
      navigate({ to: target as never, replace: true });
    } else {
      // If we are on a portal subpath (e.g. /partner) and logged out,
      // preserve that portal in the login redirect.
      const portal = resolvePortalFromPath(window.location.pathname);
      console.log("[auth] Splash redirecting to login. Context:", portal);
      navigate({ 
        to: "/auth/login", 
        search: { app: portal || undefined },
        replace: true 
      });
    }
  }, [navigate, user, loading]);



  return (
    <div className="flex min-h-svh items-center justify-center bg-black">
      <ScoobixMark size={64} className="animate-pulse" />
    </div>
  );
}
