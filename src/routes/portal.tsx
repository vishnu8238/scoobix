import { createFileRoute, Link } from "@tanstack/react-router";
import { CravioMark } from "@/components/cravio/CravioLogo";
import { Utensils, Store, Bike, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Cravio · Choose your portal" },
      { name: "description", content: "Sign in as a customer, restaurant partner, delivery rider, or admin." },
    ],
  }),
  component: Portal,
});

const ROLES = [
  { to: "/app", icon: Utensils, label: "Customer", tagline: "Order from the best spots", color: "from-emerald-500/15 to-emerald-500/5", accent: "text-primary" },
  { to: "/partner", icon: Store, label: "Restaurant Partner", tagline: "Manage orders, menu & sales", color: "from-amber-500/15 to-amber-500/5", accent: "text-amber-700" },
  { to: "/rider", icon: Bike, label: "Delivery Partner", tagline: "Accept rides, track earnings", color: "from-sky-500/15 to-sky-500/5", accent: "text-sky-700" },
  { to: "/admin", icon: ShieldCheck, label: "Master Admin", tagline: "Operate the entire platform", color: "from-violet-500/15 to-violet-500/5", accent: "text-violet-700" },
] as const;

function Portal() {
  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top,_oklch(0.96_0.04_148),_oklch(0.99_0.005_120)_60%)] px-5 py-10 md:py-16">
      <div className="mx-auto max-w-5xl animate-fade-up">
        <div className="flex flex-col items-center text-center">
          <CravioMark size={56} />
          <p className="eyebrow mt-4">Cravio Operating Platform</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Choose your portal</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Preview every Cravio experience — customer, restaurant, rider and admin — in one place.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {ROLES.map((r, i) => (
            <Link
              key={r.to}
              to={r.to}
              className="group relative overflow-hidden rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 transition hover:-translate-y-0.5 hover:shadow-float active:scale-[0.99]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${r.color} opacity-80`} />
              <div className="relative flex items-start gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-border/50 ${r.accent}`}>
                  <r.icon className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-xl font-bold">{r.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.tagline}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Cravio · Mock environment · No backend required
        </p>
      </div>
    </div>
  );
}
