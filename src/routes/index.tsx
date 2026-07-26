import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

/**
 * Shared splash screen. Each installed app opens on its own scope, so this
 * only ever routes a session to the surface that owns its role — never to a
 * portal picker.
 */
function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (loading) return;
    const target = user ? ROLE_HOME[user.role] : "/auth/login";
    const t = setTimeout(() => setExiting(true), 1100);
    const t2 = setTimeout(() => navigate({ to: target as never, replace: true }), 1600);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [navigate, user, loading]);

  return (
    <div className="relative block h-full min-h-svh w-full overflow-hidden text-left">
      <img
        src={splashBg}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${exiting ? "scale-110 opacity-30" : "scale-100 opacity-100"}`}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/85" />
      <div className="relative z-10 flex h-full min-h-svh flex-col items-center justify-center px-8 text-white">
        <div className={`transition-all duration-700 ${exiting ? "translate-y-[-12px] opacity-0" : "translate-y-0 opacity-100 animate-fade-up"}`}>
          <div className="flex justify-center"><ScoobixMark size={76} /></div>
          <h1 className="mt-5 text-center font-display text-5xl font-extrabold tracking-tight">Scoobix</h1>
          <p className="mt-3 text-center text-base text-white/80">Crave it. Get it.</p>
        </div>
        <div className="absolute bottom-12 left-0 right-0 flex justify-center">
          <div className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse-soft" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse-soft [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse-soft [animation-delay:400ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
