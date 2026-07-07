import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Sparkles, Truck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import burger from "@/assets/hero-burger.jpg";
import healthy from "@/assets/food-healthy.jpg";
import dessert from "@/assets/food-dessert.jpg";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Scoobix" }] }),
  component: Onboarding,
});

const STEPS = [
  { title: "Crave it. Get it.", body: "Discover thousands of restaurants and dishes near you, curated for your taste.", img: burger, icon: Sparkles },
  { title: "Fast, fresh, on time", body: "Live tracking and 30-minute average delivery from kitchen to doorstep.", img: healthy, icon: Truck },
  { title: "Set your spot", body: "Save Home, Work and favourites for one-tap ordering anywhere in town.", img: dessert, icon: MapPin },
];

function Onboarding() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="absolute inset-x-0 top-0 h-[58svh] overflow-hidden">
        <img src={step.img} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
      </div>

      <div className="relative flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">Step {i + 1} / {STEPS.length}</span>
        <Link to="/app" className="text-[12px] font-bold text-white/90">Skip</Link>
      </div>

      <div className="relative mt-auto rounded-t-[36px] bg-card px-7 pb-10 pt-8 shadow-pop ring-1 ring-border/60 animate-fade-up">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-7 w-7" strokeWidth={2.5} /></div>
        <h1 className="mt-5 font-display text-[28px] font-extrabold leading-tight tracking-tight">{step.title}</h1>
        <p className="mt-2 text-[14px] font-medium text-muted-foreground">{step.body}</p>

        <div className="mt-7 flex items-center gap-2">
          {STEPS.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-2 bg-foreground/15"}`} />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          {i > 0 && (
            <Button variant="ghost" className="rounded-full" onClick={() => setI(i - 1)}>Back</Button>
          )}
          <Button
            className="ml-auto h-12 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
            onClick={() => (last ? navigate({ to: "/app" }) : setI(i + 1))}
          >
            {last ? "Get started" : "Continue"} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
