import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, FileText, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import {
  usePlans, useSubscription, subscribe, renewSubscription, subscriptionStatus,
  daysRemaining, planPrice, remainingQuota, usedThisPeriod, LIMIT_LABEL,
  type Plan,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/partner/subscription")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · Subscription & plan usage" },
      { name: "description", content: "Your Scoobix restaurant plan: commission, limits, usage, invoices and renewal." },
    ],
  }),
  component: PartnerSubscription,
});

const PERIOD_LABEL: Record<string, string> = {
  none: "", monthly: "/month", quarterly: "/quarter", yearly: "/year", custom: "",
};

function PartnerSubscription() {
  const { restaurant, restaurantId } = usePartnerRestaurant();
  const { user } = useAuth();
  const { plans, loading: plansLoading } = usePlans("restaurant");
  const { subscription, plan, benefits, usage, invoices, loading, refresh } =
    useSubscription("restaurant", restaurantId || null);
  const [busy, setBusy] = useState("");

  const status = subscriptionStatus(subscription);
  const left = daysRemaining(subscription);
  const isActive = status === "active" || status === "trialing";

  const quotas = useMemo(
    () => ["menu_items", "branches", "offers", "campaign_credits"].map((metric) => ({
      metric,
      label: LIMIT_LABEL[metric] ?? metric,
      used: usedThisPeriod(usage, metric),
      quota: Number(plan?.limits?.[metric] ?? 0),
      left: remainingQuota(plan, usage, metric),
    })),
    [plan, usage],
  );

  const suggestion = useMemo(() => {
    if (!plan) return plans[0] ?? null;
    const tight = quotas.some((q) => q.quota > 0 && q.quota < 9999 && q.used / q.quota >= 0.8);
    if (!tight) return null;
    return plans.find((p) => planPrice(p) > planPrice(plan)) ?? null;
  }, [plan, plans, quotas]);

  const choose = (p: Plan) => {
    if (!restaurantId) { toast.error("Restaurant not resolved yet"); return; }
    setBusy(p.id);
    void subscribe({
      plan: p,
      subjectType: "restaurant",
      subjectId: restaurantId,
      actor: { id: user?.id, email: user?.email, role: "restaurant" },
    }).then((sub) => {
      setBusy("");
      if (!sub) { toast.error("Could not switch plan"); return; }
      toast.success(`${p.name} is now active`);
      void refresh();
    });
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Subscription" subtitle={restaurant?.name ?? "Your Scoobix plan"} />

      <section className="mx-4 mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Current plan</p>
        <p className="mt-1 font-display text-xl font-extrabold">{plan?.name ?? "No active plan"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isActive
            ? `${status} · commission ${plan?.commission_percent ?? "—"}% · renews ${subscription?.renewal_date ? new Date(subscription.renewal_date).toDateString() : "—"}`
            : "Pick a plan below to unlock listing and growth features."}
        </p>
        {isActive && subscription && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => { setBusy("renew"); void renewSubscription(subscription, plan, { id: user?.id, role: "restaurant" }).then(() => { setBusy(""); toast.success("Plan renewed"); void refresh(); }); }}
              disabled={busy === "renew"}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-bold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {busy === "renew" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Renew
            </button>
            {left <= 7 && (
              <span className="rounded-full bg-amber-100 px-3 py-2 text-[11px] font-bold text-amber-800">
                Renews in {left} day{left === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </section>

      {/* usage & remaining limits */}
      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Usage this month</p>
        <ul className="mt-3 space-y-3">
          {quotas.map((q) => {
            const pct = q.quota > 0 ? Math.min(100, Math.round((q.used / q.quota) * 100)) : 0;
            return (
              <li key={q.metric}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold">{q.label}</span>
                  <span className="text-muted-foreground">
                    {q.used} / {q.quota >= 9999 ? "∞" : q.quota || "—"}
                    {q.left === -1 ? " · unlimited" : q.quota ? ` · ${q.left} left` : ""}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3 text-[11px] font-bold">
          {[
            ["priority_listing", "Priority listing"],
            ["analytics", "Analytics"],
            ["verification_badge", "Verified badge"],
            ["dedicated_support", "Dedicated support"],
          ].map(([key, label]) => (
            <span
              key={key}
              className={`rounded-full px-2.5 py-1 ${benefits[key] ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {suggestion && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-3xl bg-primary-soft p-4 text-[12.5px] text-primary">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
          <span>You are close to your plan limits. <b>{suggestion.name}</b> raises them and lowers commission to {suggestion.commission_percent}%.</span>
        </div>
      )}

      {plansLoading || loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : plans.length === 0 ? (
        <p className="mx-4 mt-6 text-center text-sm text-muted-foreground">No plans available right now.</p>
      ) : (
        <ul className="mx-4 mt-4 space-y-3">
          {plans.map((p) => {
            const current = subscription?.plan_id === p.id && isActive;
            return (
              <li key={p.id} className={`rounded-3xl bg-card p-5 shadow-soft ring-1 ${current ? "ring-primary/60" : "ring-border/60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-display text-lg font-extrabold">
                      {p.name} {current && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> {p.commission_percent ?? "—"}% commission
                      {p.limits?.branches ? ` · ${p.limits.branches} branches` : ""}
                      {p.limits?.menu_items ? ` · ${p.limits.menu_items} items` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-lg font-extrabold text-primary">
                    {formatPrice(planPrice(p))}
                    <span className="text-[11px] font-bold text-muted-foreground">{PERIOD_LABEL[p.billing_period ?? "monthly"]}</span>
                  </p>
                </div>
                <button
                  onClick={() => choose(p)}
                  disabled={current || busy === p.id}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {current ? "Current plan" : planPrice(p) > planPrice(plan) ? "Upgrade" : "Switch plan"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mx-4 mt-5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><FileText className="h-4 w-4 text-primary" /> Billing history</p>
        {invoices.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{i.invoice_no}</p>
                  <p className="text-[11px] text-muted-foreground">{i.plan_name} · {i.created_at ? new Date(i.created_at).toLocaleDateString() : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold">{formatPrice(i.total ?? 0)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{i.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
