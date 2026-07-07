import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CalendarClock, Pause, Play, SkipForward, Trash2, Plus, Utensils } from "lucide-react";
import { restaurants } from "@/lib/mock-data";
import { useMealPlan, type MealPlanSubscription } from "@/lib/scoobix-extras";
import { Button } from "@/components/ui/button";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { currency, cn } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/meal")({
  head: () => ({ meta: [
    { title: "Scoobix Daily Meal · Subscriptions" },
    { name: "description", content: "Weekly and monthly Scoobix meal plans — lunch, dinner or both, pause or skip any day." },
    { property: "og:title", content: "Scoobix Daily Meal" },
    { property: "og:description", content: "Recurring meals from your favourite kitchens, delivered daily." },
  ] }),
  component: MealPlanPage,
});

function MealPlanPage() {
  const navigate = useNavigate();
  const { subs, pause, resume, skipDate, cancel, create } = useMealPlan();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-svh pb-28">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/more" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Scoobix Daily Meal</h1>
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center animate-fade-up">
            <div className="grid h-28 w-28 place-items-center rounded-full bg-primary-soft text-primary shadow-soft ring-1 ring-primary/10">
              <Utensils className="h-9 w-9" />
            </div>
            <h3 className="mt-6 font-display text-[22px] font-extrabold tracking-tight">No active plans</h3>
            <p className="mt-2 max-w-xs text-[13.5px] font-medium text-muted-foreground">Start a weekly or monthly meal plan and skip forever thinking 'what to eat'.</p>
            <button onClick={() => setOpen(true)} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-[13px] font-extrabold uppercase tracking-widest text-primary-foreground shadow-glow transition active:scale-95">Start a plan</button>
          </div>
        ) : subs.map((s) => <SubCard key={s.id} sub={s} onPause={pause} onResume={resume} onSkip={skipDate} onCancel={cancel} />)}
      </div>


      <NewPlanSheet open={open} onClose={() => setOpen(false)} onCreate={(input) => { create(input); toast.success("Meal plan started"); setOpen(false); }} />
    </div>
  );
}

function SubCard({ sub, onPause, onResume, onSkip, onCancel }: {
  sub: MealPlanSubscription;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onSkip: (id: string, iso: string) => void;
  onCancel: (id: string) => void;
}) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sub.plan === "weekly" ? "Weekly plan" : "Monthly plan"} · {sub.meals}</p>
          <h3 className="mt-0.5 font-display text-lg font-extrabold">{sub.restaurantName}</h3>
          <p className="text-xs text-muted-foreground">Starts {sub.startsOn} · {currency(sub.price)} / meal</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", sub.paused ? "bg-warning/15 text-[oklch(0.45_0.14_70)]" : "bg-primary-soft text-primary")}>
          {sub.paused ? "Paused" : "Active"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {sub.paused ? (
          <Button onClick={() => onResume(sub.id)} size="sm" className="rounded-full"><Play className="mr-1 h-3 w-3" /> Resume</Button>
        ) : (
          <Button onClick={() => onPause(sub.id)} variant="outline" size="sm" className="rounded-full"><Pause className="mr-1 h-3 w-3" /> Pause</Button>
        )}
        <Button onClick={() => onSkip(sub.id, tomorrow)} variant="outline" size="sm" className="rounded-full"><SkipForward className="mr-1 h-3 w-3" /> Skip tomorrow</Button>
        <Button onClick={() => onCancel(sub.id)} variant="outline" size="sm" className="rounded-full text-destructive"><Trash2 className="mr-1 h-3 w-3" /> Cancel</Button>
      </div>
      {sub.skippedDates.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">Skipped: {sub.skippedDates.slice(-3).join(", ")}</p>
      )}
    </div>
  );
}

function NewPlanSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (i: Omit<MealPlanSubscription, "id" | "paused" | "skippedDates" | "createdAt">) => void }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [plan, setPlan] = useState<"weekly" | "monthly">("weekly");
  const [meals, setMeals] = useState<"lunch" | "dinner" | "both">("both");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const r = restaurants.find((x) => x.id === restaurantId) ?? restaurants[0];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> New meal plan</SheetTitle>
          <SheetDescription>Recurring meals, delivered daily. Pause or skip any day.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="eyebrow">Kitchen</span>
            <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="mt-1 w-full rounded-2xl bg-secondary px-3 py-2.5 text-sm font-semibold outline-none">
              {restaurants.slice(0, 12).map((rr) => <option key={rr.id} value={rr.id}>{rr.name}</option>)}
            </select>
          </label>
          <div>
            <p className="eyebrow">Plan</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["weekly", "monthly"] as const).map((p) => (
                <button key={p} onClick={() => setPlan(p)} className={cn("rounded-2xl border-2 p-3 text-sm font-bold capitalize", plan === p ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Meals</p>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["lunch", "dinner", "both"] as const).map((m) => (
                <button key={m} onClick={() => setMeals(m)} className={cn("rounded-2xl border-2 p-3 text-sm font-bold capitalize", meals === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>{m}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="eyebrow">Starts on</span>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="mt-1 w-full rounded-2xl bg-secondary px-3 py-2.5 text-sm font-semibold outline-none" />
          </label>
          <Button
            onClick={() => r && onCreate({
              restaurantId: r.id, restaurantName: r.name, plan, meals, startsOn,
              addressLabel: "Home", price: meals === "both" ? 320 : 180,
            })}
            className="h-12 w-full rounded-full gradient-primary text-primary-foreground shadow-glow"
          >
            Start plan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
