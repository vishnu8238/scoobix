import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME, ROLE_ONBOARDING, resolvePortalFromPath } from "@/lib/auth-store";
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
    // Safety exit for hangs: if user isn't loading but also isn't present, 
    // we must redirect to login rather than staying on splash.
    if (!loading && !user) {
      const portal = resolvePortalFromPath(window.location.pathname);
      console.log("[auth] Splash: Not loading and no user. Redirecting to login. Context:", portal);
      navigate({ 
        to: "/auth/login", 
        search: { app: portal || undefined },
        replace: true 
      });
      return;
    }

    if (loading) return;
    
    if (user) {
      const hasRole = (r: Role) => user.roles.includes(r);
      // AUTHORITATIVE: The URL path determines the portal we land in.
      // If we are at root "/", we default to the Customer portal.
      const portal = resolvePortalFromPath(window.location.pathname) || "customer";
      
      let target = "/app";
      
      if (hasRole(portal)) {
        target = ROLE_HOME[portal];
      } else {
        // Explicit portal requested but user lacks membership -> Onboarding.
        // If they are already in the portal path (e.g. /partner), send to that portal's onboarding.
        target = ROLE_ONBOARDING[portal] || "/app";
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
