import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { useAuth, ROLE_HOME, ROLE_ONBOARDING, getRequestedPortal, resolveAuthenticatedDestination, resolveUserMemberships } from "@/lib/auth-store";
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
  const { user, loading } = useAuth();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      const intent = getRequestedPortal(window.location.pathname, window.location.search);
      console.log("[AUTH_FORENSIC] Splash: No user. Redirecting to login. Intent:", intent);
      navigate({ 
        to: "/auth/login", 
        search: { app: intent || undefined },
        replace: true 
      });
      return;
    }
    
    // AuthProvider handles navigation for authenticated users on boot if they are on "/"
    console.log("[AUTH_FORENSIC] Splash: Authenticated user detected. Waiting for admission...");
  }, [navigate, user, loading]);




  return (
    <div className="flex min-h-svh items-center justify-center bg-black">
      <ScoobixMark size={64} className="animate-pulse" />
    </div>
  );
}
