import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import splashBg from "@/assets/splash-bg.jpg";
import { CravioMark } from "@/components/cravio/CravioLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cravio — Crave it. Get it." },
      { name: "description", content: "Premium food delivery from the best restaurants near you." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), 1500);
    const t2 = setTimeout(() => navigate({ to: "/app" }), 2100);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [navigate]);

  return (
    <button
      onClick={() => navigate({ to: "/app" })}
      className="relative block h-full min-h-svh w-full overflow-hidden text-left"
      aria-label="Enter Cravio"
    >
      <img
        src={splashBg}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${exiting ? "scale-110 opacity-30" : "scale-100 opacity-100"}`}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/85" />
      <div className="relative z-10 flex h-full min-h-svh flex-col items-center justify-center px-8 text-white">
        <div className={`transition-all duration-700 ${exiting ? "translate-y-[-12px] opacity-0" : "translate-y-0 opacity-100 animate-fade-up"}`}>
          <div className="flex justify-center"><CravioMark size={76} /></div>
          <h1 className="mt-5 text-center font-display text-5xl font-extrabold tracking-tight">Cravio</h1>
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
    </button>
  );
}
