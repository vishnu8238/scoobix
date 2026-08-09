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
    // The Splash screen is a passive listener. 
    // It should not trigger its own redirects if AuthProvider is booting.
    if (loading) return;
    
    if (!user) {
      const intent = getPortalIntent(window.location.pathname, window.location.search);
      console.log("[AUTH_FORENSIC] Splash: No user. Redirecting to login. Intent:", intent);
      navigate({ 
        to: "/auth/login", 
        search: { app: intent || undefined },
        replace: true 
      });
      return;
    }
    
    // If user exists, ensure they are in the right place.
    const intent = getPortalIntent(window.location.pathname, window.location.search);
    const destination = resolveAuthenticatedDestination(user, intent);
    console.log("[AUTH_FORENSIC] Splash: User exists. Redirecting to authoritative destination:", destination);
    window.location.assign(destination);
  }, [navigate, user, loading]);



  return (
    <div className="flex min-h-svh items-center justify-center bg-black">
      <ScoobixMark size={64} className="animate-pulse" />
    </div>
  );
}
