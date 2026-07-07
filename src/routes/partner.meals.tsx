import { createFileRoute } from "@tanstack/react-router";
import { useMealPlan } from "@/lib/scoobix-extras";
import { useAuth } from "@/lib/auth-store";
import { Utensils } from "lucide-react";

export const Route = createFileRoute("/partner/meals")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Meal Plans" }] }),
  component: PartnerMeals,
});

function PartnerMeals() {
  const { user } = useAuth();
  const { subs, nextDayCount } = useMealPlan();
  const restaurantId = ((user as unknown as { restaurantId?: string })?.restaurantId) ?? subs[0]?.restaurantId ?? "";
  const counts = nextDayCount(restaurantId);
  const mine = subs.filter((s) => s.restaurantId === restaurantId);

  return (
    <div className="animate-fade-up px-5 pt-7 pb-24">
      <header className="mb-5">
        <p className="eyebrow">Meal plans</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Next-day meal count</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirmed Scoobix Daily Meal subscribers for tomorrow.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Lunch" value={counts.lunch} />
        <Kpi label="Dinner" value={counts.dinner} />
      </div>

      <section className="mt-6">
        <p className="eyebrow mb-2">Active subscribers</p>
        {mine.length === 0 ? (
          <div className="rounded-3xl bg-card p-10 text-center shadow-soft ring-1 ring-border/60">
            <Utensils className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No meal subscribers yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {mine.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div>
                  <p className="text-sm font-bold capitalize">{s.plan} · {s.meals}</p>
                  <p className="text-[11px] text-muted-foreground">Starts {s.startsOn} · {s.paused ? "paused" : "active"}</p>
                </div>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">#{s.id.slice(-4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-primary tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">meals to prepare</p>
    </div>
  );
}
