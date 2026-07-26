import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { createRecord, listTable } from "@/lib/insforge-crud";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/partner/subscription")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Subscription" }] }),
  component: PartnerSubscription,
});

type Plan = { id: string; name?: string | null; description?: string | null; monthly_fee?: number | null; delivery_benefits?: string | null; active?: boolean | null };
type Sub = { id: string; plan_id?: string | null; status?: string | null; start_date?: string | null; expiry_date?: string | null };

function PartnerSubscription() {
  const { restaurant, restaurantId } = usePartnerRestaurant();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([
      listTable<Plan>("subscription_plans", { active: "eq.true", limit: 50 }),
      restaurantId
        ? listTable<Sub>("restaurant_subscriptions", { restaurant_id: `eq.${restaurantId}`, order: "created_at.desc", limit: 20 })
        : Promise.resolve([] as Sub[]),
    ]);
    setPlans(p);
    setSubs(s);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const current = subs.find((s) => (s.status ?? "").toLowerCase() === "active") ?? subs[0] ?? null;

  const subscribe = async (plan: Plan) => {
    if (!restaurantId) { toast.error("Restaurant not resolved yet"); return; }
    setBusy(plan.id);
    const today = new Date();
    const expiry = new Date(today.getTime() + 30 * 864e5);
    const created = await createRecord("restaurant_subscriptions", {
      restaurant_id: restaurantId,
      plan_id: plan.id,
      start_date: today.toISOString().slice(0, 10),
      expiry_date: expiry.toISOString().slice(0, 10),
      status: "pending",
    });
    setBusy("");
    if (!created) { toast.error("Could not submit request"); return; }
    toast.success(`${plan.name} requested — admin will activate it`);
    void refresh();
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Subscription" subtitle="Your Scoobix plan" />

      <section className="mx-4 mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Current plan</p>
        <p className="mt-1 font-display text-xl font-extrabold">
          {plans.find((p) => p.id === (current?.plan_id ?? restaurant?.["subscription_plan_id" as keyof typeof restaurant]))?.name ?? "No active plan"}
        </p>
        {current && (
          <p className="mt-1 text-xs text-muted-foreground">
            {current.status} · {current.start_date ?? "—"} → {current.expiry_date ?? "—"}
          </p>
        )}
      </section>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : plans.length === 0 ? (
        <p className="mx-4 mt-6 text-center text-sm text-muted-foreground">No plans available right now.</p>
      ) : (
        <ul className="mx-4 mt-4 space-y-3">
          {plans.map((p) => {
            const active = current?.plan_id === p.id && (current?.status ?? "") === "active";
            return (
              <li key={p.id} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-extrabold">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    {p.delivery_benefits && <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary"><Sparkles className="h-3.5 w-3.5" /> {p.delivery_benefits}</p>}
                  </div>
                  <p className="shrink-0 font-display text-lg font-extrabold text-primary">{formatPrice(p.monthly_fee ?? 0)}<span className="text-[11px] font-bold text-muted-foreground">/mo</span></p>
                </div>
                <button
                  onClick={() => subscribe(p)}
                  disabled={active || busy === p.id}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {active ? "Current plan" : "Request plan"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
