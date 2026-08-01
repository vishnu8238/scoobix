import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BadgeCheck, CalendarClock, Crown, FileText, Loader2, RefreshCw, Sparkles, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import {
  usePlans, useSubscription, subscribe, renewSubscription, cancelSubscription,
  setAutoRenew, subscriptionStatus, daysRemaining, planPrice, savedThisPeriod,
  lifetimeSavings, usedThisPeriod, benefitEnabled, benefitNumber,
  BENEFIT_KEYS, BENEFIT_LABEL, type Plan,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/app/membership")({
  head: () => ({
    meta: [
      { title: "Scoobix Plus · Membership & savings" },
      { name: "description", content: "Manage your Scoobix Plus membership: benefits, savings, renewal date and invoices." },
      { property: "og:title", content: "Scoobix Plus membership" },
      { property: "og:description", content: "Free delivery, extra rewards and priority support with Scoobix Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembershipPage,
});

const PERIOD_LABEL: Record<string, string> = {
  none: "Free", monthly: "/month", quarterly: "/quarter", yearly: "/year", custom: "",
};

function benefitValueLabel(key: string, value: number | boolean | string | undefined): string {
  if (value === undefined || value === false || value === 0) return "—";
  if (key === "free_delivery") return Number(value) < 0 ? "Unlimited" : `${value} per month`;
  if (key === "delivery_discount_pct") return `${value}% off`;
  if (key === "loyalty_multiplier" || key === "reward_multiplier") return `${value}x`;
  if (key === "free_cancellations") return `${value} per month`;
  if (typeof value === "number") return String(value);
  return "Included";
}

function MembershipPage() {
  const { user } = useAuth();
  const { plans, loading: plansLoading } = usePlans("customer");
  const {
    subscription, plan, benefits, usage, invoices, history, loading, refresh,
  } = useSubscription("customer", user?.id);
  const [busy, setBusy] = useState("");

  const status = subscriptionStatus(subscription);
  const left = daysRemaining(subscription);
  const monthSaved = useMemo(() => savedThisPeriod(usage), [usage]);
  const totalSaved = useMemo(() => lifetimeSavings(usage), [usage]);
  const freeUsed = useMemo(() => usedThisPeriod(usage, "free_delivery"), [usage]);
  const isMember = !!subscription && (status === "active" || status === "trialing");

  const act = async (fn: () => Promise<unknown>, key: string, done: string) => {
    setBusy(key);
    await fn();
    setBusy("");
    toast.success(done);
    void refresh();
  };

  const choose = (p: Plan) => {
    if (!user?.id) { toast.error("Sign in to manage your membership"); return; }
    const upgrade = !subscription || planPrice(p) > Number(subscription.price ?? 0);
    void act(
      () => subscribe({
        plan: p,
        subjectType: "customer",
        subjectId: user.id,
        actor: { id: user.id, email: user.email, role: "customer" },
        withTrial: !subscription && Number(p.trial_days ?? 0) > 0,
      }),
      p.id,
      upgrade ? `${p.name} activated` : `Moved to ${p.name}`,
    );
  };

  return (
    <div className="min-h-svh pb-16">
      <PageHeader
        title="Scoobix Plus"
        subtitle={isMember ? `${plan?.name ?? "Member"} · ${left} day${left === 1 ? "" : "s"} left` : "Membership & savings"}
      />

      {/* membership card */}
      <div className="px-4 pt-4">
        <div className="rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-90">
              <Crown className="h-3.5 w-3.5" /> {isMember ? status : "Free plan"}
            </span>
            {isMember && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                {left} days left
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight">
            {plan?.name ?? "Scoobix Free"}
          </h2>
          <p className="mt-1 text-[12.5px] opacity-90">
            {isMember
              ? `Renews ${subscription?.renewal_date ? new Date(subscription.renewal_date).toDateString() : "—"}`
              : "Join Plus for free delivery and double rewards"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Saved this month</p>
              <p className="mt-0.5 font-display text-lg font-extrabold">{formatPrice(monthSaved)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Lifetime savings</p>
              <p className="mt-0.5 font-display text-lg font-extrabold">{formatPrice(totalSaved)}</p>
            </div>
          </div>
        </div>
      </div>

      {isMember && subscription && (
        <div className="mt-3 flex flex-wrap gap-2 px-4">
          <button
            onClick={() => void act(() => renewSubscription(subscription, plan), "renew", "Membership renewed")}
            disabled={busy === "renew"}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-bold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {busy === "renew" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Renew now
          </button>
          <button
            onClick={() => void act(() => setAutoRenew(subscription, !(subscription.auto_renew ?? true)), "auto", "Auto-renew updated")}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-[12px] font-bold"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Auto-renew {subscription.auto_renew === false ? "off" : "on"}
          </button>
          <button
            onClick={() => void act(() => cancelSubscription(subscription, "customer_request", { id: user?.id, role: "customer" }), "cancel", "Membership cancelled")}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-[12px] font-bold text-rose-600"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      )}

      {isMember && left <= 5 && (
        <p className="mx-4 mt-3 rounded-2xl bg-amber-50 p-3 text-[12px] font-semibold text-amber-800">
          {status === "trialing"
            ? `Your trial ends in ${left} day${left === 1 ? "" : "s"} — pick a plan to keep your benefits.`
            : `Your plan renews in ${left} day${left === 1 ? "" : "s"}.`}
        </p>
      )}

      {/* benefits + usage */}
      <section className="mx-4 mt-5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" /> Benefits</p>
        <ul className="mt-3 space-y-2">
          {BENEFIT_KEYS.map((key) => {
            const on = benefitEnabled(benefits, key);
            return (
              <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
                <span className={on ? "font-semibold" : "text-muted-foreground"}>
                  {BENEFIT_LABEL[key]}
                </span>
                <span className={on ? "font-bold text-primary" : "text-muted-foreground"}>
                  {benefitValueLabel(key, benefits[key])}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 border-t border-border/60 pt-3 text-[12px] text-muted-foreground">
          Free deliveries used this month: <b className="text-foreground">{freeUsed}</b>
          {benefitNumber(benefits, "free_delivery", 0) > 0 && ` of ${benefitNumber(benefits, "free_delivery", 0)}`}
        </div>
      </section>

      {/* plans */}
      <h3 className="mx-4 mt-6 font-display text-base font-extrabold">Choose your plan</h3>
      {plansLoading || loading ? (
        <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : plans.length === 0 ? (
        <EmptyState icon={<Crown className="h-9 w-9" />} title="No plans yet" description="Membership plans will appear here once published." />
      ) : (
        <ul className="mx-4 mt-3 space-y-3">
          {plans.map((p) => {
            const current = subscription?.plan_id === p.id && isMember;
            return (
              <li key={p.id} className={`rounded-3xl bg-card p-4 shadow-soft ring-1 ${current ? "ring-primary/60" : "ring-border/60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-base font-extrabold">
                      {p.name} {current && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    {Number(p.trial_days ?? 0) > 0 && !subscription && (
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">{p.trial_days}-day free trial</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-extrabold text-primary">{formatPrice(planPrice(p))}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">{PERIOD_LABEL[p.billing_period ?? "monthly"]}</p>
                    {p.compare_price ? <p className="text-[11px] text-muted-foreground line-through">{formatPrice(p.compare_price)}</p> : null}
                  </div>
                </div>
                <button
                  onClick={() => choose(p)}
                  disabled={current || busy === p.id}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
                >
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {current ? "Current plan" : subscription && planPrice(p) < Number(subscription.price ?? 0) ? "Switch to this plan" : "Choose plan"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* invoices */}
      <section className="mx-4 mt-6 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><FileText className="h-4 w-4 text-primary" /> Invoices</p>
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

      {/* history */}
      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Membership history</p>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="capitalize">{String(h.action).replace(/_/g, " ")}</span>
                <span className="shrink-0 text-muted-foreground">{h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
