import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME, ROLE_ONBOARDING, getPortalIntent, resolveAuthenticatedDestination } from "@/lib/auth-store";
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
      const intent = getPortalIntent(window.location.pathname, window.location.search);
      console.log("[auth] Splash: Redirecting to login. Intent:", intent);
      navigate({ 
        to: "/auth/login", 
        search: { app: intent || undefined },
        replace: true 
      });
      return;
    }

    if (loading) return;
    
    if (user) {
      const intent = getPortalIntent(window.location.pathname, window.location.search);
      const target = resolveAuthenticatedDestination(user, intent);
      
      console.log("[auth] Splash: Authenticated redirect. Intent:", intent, "Target:", target);
      navigate({ to: target as never, replace: true });
    } else {
      const intent = getPortalIntent(window.location.pathname, window.location.search);
      console.log("[auth] Splash: Anonymous redirect. Intent:", intent);
      navigate({ 
        to: "/auth/login", 
        search: { app: intent || undefined },
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
