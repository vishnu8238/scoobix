import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart3, Crown, Layers, Loader2, PauseCircle, PlayCircle, Plus, RefreshCw,
  Sparkles, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { formatPrice } from "@/lib/format";
import {
  useSubscriptionAdmin, setPlanStatus, clonePlan,
  subscriptionStatus, planPrice, AUDIENCE_LABEL, type Audience, type Plan,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/logistics/subscriptions")({
  head: () => ({
    meta: [
      { title: "Scoobix Logistics · Subscriptions" },
      { name: "description", content: "Monitor membership and subscription plans, MRR, churn, and LTV." },
    ],
  }),
  component: LogisticsSubscriptions,
});

const AUDIENCES: Audience[] = ["customer", "restaurant", "manager", "rider"];

function LogisticsSubscriptions() {
  const { plans, subs, analytics, loading, error, refresh } = useSubscriptionAdmin();
  const [audience, setAudience] = useState<Audience>("customer");
  const [busy, setBusy] = useState("");

  const audiencePlans = useMemo(
    () => plans.filter((p) => (p.audience ?? "customer") === audience),
    [plans, audience],
  );
  const audienceSubs = useMemo(
    () => subs.filter((s) => (s.subject_type ?? "customer") === audience),
    [subs, audience],
  );

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      void refresh();
    } catch (err) {
      toast.error(`Couldn't complete action: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-lg font-bold">Couldn't load subscriptions</p>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <button onClick={() => void refresh()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Retry</button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-[980px] pb-24">
      <PageHeader title="Subscriptions" subtitle="Plans, members, MRR & churn" />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "MRR", value: formatPrice(analytics.mrr), icon: BarChart3 },
          { label: "Active", value: String(analytics.activeCount), icon: Users },
          { label: "Churn", value: `${analytics.churnRate}%`, icon: Layers },
          { label: "LTV", value: formatPrice(analytics.ltv), icon: Crown },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <k.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-display text-lg font-extrabold">{k.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            onClick={() => setAudience(a)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold ${audience === a ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary"}`}
          >
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>

      <h3 className="mt-6 font-display text-base font-extrabold">Plans</h3>
      {audiencePlans.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No plans for this audience yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {audiencePlans.map((p) => (
            <PlanRow key={p.id} plan={p} busy={busy} run={run} count={audienceSubs.filter((s) => s.plan_id === p.id).length} />
          ))}
        </ul>
      )}

      <h3 className="mt-6 font-display text-base font-extrabold">Recent Subscribers ({audienceSubs.length})</h3>
      {audienceSubs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No subscribers in this audience.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60 rounded-3xl bg-card px-4 shadow-soft ring-1 ring-border/60">
          {audienceSubs.slice(0, 20).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-[12.5px]">
              <div className="min-w-0">
                <p className="truncate font-semibold">{plans.find((p) => p.id === s.plan_id)?.name ?? "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{s.subject_id}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">{formatPrice(s.price ?? 0)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{subscriptionStatus(s)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanRow({
  plan, count, busy, run,
}: {
  plan: Plan;
  count: number;
  busy: string;
  run: (key: string, fn: () => Promise<unknown>, msg: string) => Promise<void>;
}) {
  const paused = plan.status === "paused";

  return (
    <li className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[140px] flex-1 text-[13px] font-bold">{plan.name}</span>
        <span className="w-24 text-[13px] font-bold">{formatPrice(planPrice(plan))}</span>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
          {count} member{count === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {plan.status ?? "draft"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run(`st-${plan.id}`, () => setPlanStatus(plan.id, paused ? "active" : "paused", { role: "admin" }), paused ? "Plan activated" : "Plan paused")}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold"
        >
          {paused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
          {paused ? "Activate" : "Pause"}
        </button>
        <button
          onClick={() => run(`cl-${plan.id}`, () => clonePlan(plan, { role: "admin" }), "Plan duplicated")}
          className="rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold"
        >
          Duplicate
        </button>
      </div>
    </li>
  );
}
