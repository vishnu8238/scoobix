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
  useSubscriptionAdmin, createPlan, updatePlan, setPlanStatus, clonePlan, deletePlan,
  seedCatalogue, bulkMovePlan, sendRenewalReminders, expiringSoon, subscriptionStatus,
  planPrice, AUDIENCE_LABEL, type Audience, type Plan,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Subscriptions, MRR & plans" },
      { name: "description", content: "Manage membership and subscription plans, monitor MRR, churn, LTV and move subscribers in bulk." },
    ],
  }),
  component: AdminSubscriptions,
});

const AUDIENCES: Audience[] = ["customer", "restaurant", "manager", "rider"];

function AdminSubscriptions() {
  const { plans, subs, analytics, invoices, loading, refresh } = useSubscriptionAdmin();
  const [audience, setAudience] = useState<Audience>("customer");
  const [busy, setBusy] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");

  const audiencePlans = useMemo(
    () => plans.filter((p) => (p.audience ?? "customer") === audience),
    [plans, audience],
  );
  const audienceSubs = useMemo(
    () => subs.filter((s) => (s.subject_type ?? "customer") === audience),
    [subs, audience],
  );
  const expiring = useMemo(() => expiringSoon(subs, 5), [subs]);

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    await fn();
    setBusy("");
    toast.success(msg);
    void refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-[980px] pb-24">
      <PageHeader title="Subscriptions" subtitle="Plans, members, MRR & churn" />

      {/* KPI grid */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "MRR", value: formatPrice(analytics.mrr), icon: BarChart3 },
          { label: "ARR", value: formatPrice(analytics.arr), icon: BarChart3 },
          { label: "Active", value: String(analytics.activeCount), icon: Users },
          { label: "Trialing", value: String(analytics.trialCount), icon: Sparkles },
          { label: "Churn", value: `${analytics.churnRate}%`, icon: Layers },
          { label: "Retention", value: `${analytics.retentionRate}%`, icon: Layers },
          { label: "LTV", value: formatPrice(analytics.ltv), icon: Crown },
          { label: "Collected", value: formatPrice(analytics.revenueCollected), icon: BarChart3 },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <k.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-display text-lg font-extrabold">{k.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* distribution */}
      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Plan distribution</p>
        {analytics.distribution.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No subscribers yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {analytics.distribution.map((d) => {
              const max = Math.max(...analytics.distribution.map((x) => x.count), 1);
              return (
                <li key={d.planId}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold">{d.name}</span>
                    <span className="text-muted-foreground">{d.count} · {formatPrice(d.mrr)} MRR</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <button
            onClick={() => run("seed", () => seedCatalogue({ role: "admin" }), "Starter catalogue published")}
            disabled={busy === "seed"}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" /> Publish starter catalogue
          </button>
          <button
            onClick={() => { const n = sendRenewalReminders(subs, 5); toast.success(`${n} renewal reminder${n === 1 ? "" : "s"} queued`); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Send renewal reminders ({expiring.length})
          </button>
        </div>
      </section>

      {/* audience tabs */}
      <div className="mx-4 mt-5 flex gap-2 overflow-x-auto pb-1">
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

      {/* plans */}
      <div className="mx-4 mt-3 flex items-center justify-between">
        <h3 className="font-display text-base font-extrabold">Plans</h3>
        <button
          onClick={() => run("new", () => createPlan({
            name: "New plan",
            audience,
            price: 0,
            billing_period: "monthly",
            status: "draft",
          }, { role: "admin" }), "Draft plan created")}
          disabled={busy === "new"}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" /> New plan
        </button>
      </div>

      {audiencePlans.length === 0 ? (
        <p className="mx-4 mt-3 text-xs text-muted-foreground">No plans for this audience yet.</p>
      ) : (
        <ul className="mx-4 mt-3 space-y-3">
          {audiencePlans.map((p) => (
            <PlanRow key={p.id} plan={p} busy={busy} run={run} count={audienceSubs.filter((s) => s.plan_id === p.id).length} />
          ))}
        </ul>
      )}

      {/* bulk move */}
      <section className="mx-4 mt-5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Bulk move subscribers</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} className="rounded-2xl bg-secondary px-3 py-2 text-[12px] font-semibold">
            <option value="">From plan…</option>
            {audiencePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} className="rounded-2xl bg-secondary px-3 py-2 text-[12px] font-semibold">
            <option value="">To plan…</option>
            {audiencePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            disabled={!bulkFrom || !bulkTo || bulkFrom === bulkTo || busy === "bulk"}
            onClick={() => {
              const target = audiencePlans.find((p) => p.id === bulkTo);
              if (!target) return;
              void run("bulk", async () => {
                const n = await bulkMovePlan(bulkFrom, target, audienceSubs, { role: "admin" });
                toast.message(`${n} subscriber${n === 1 ? "" : "s"} moved`);
              }, "Bulk move complete");
            }}
            className="rounded-full bg-primary px-3.5 py-2 text-[12px] font-bold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            Move
          </button>
        </div>
      </section>

      {/* subscribers */}
      <h3 className="mx-4 mt-6 font-display text-base font-extrabold">Subscribers ({audienceSubs.length})</h3>
      {audienceSubs.length === 0 ? (
        <p className="mx-4 mt-2 text-xs text-muted-foreground">No subscribers in this audience.</p>
      ) : (
        <ul className="mx-4 mt-2 divide-y divide-border/60 rounded-3xl bg-card px-4 shadow-soft ring-1 ring-border/60">
          {audienceSubs.slice(0, 60).map((s) => (
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

      <p className="mx-4 mt-4 text-[11px] text-muted-foreground">
        {invoices.length} invoice{invoices.length === 1 ? "" : "s"} on record · average member savings {formatPrice(analytics.averageSavings)}
      </p>
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
  const [name, setName] = useState(plan.name ?? "");
  const [price, setPrice] = useState(String(planPrice(plan)));
  const [commission, setCommission] = useState(String(plan.commission_percent ?? ""));
  const paused = plan.status === "paused";

  return (
    <li className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[140px] flex-1 rounded-2xl bg-secondary px-3 py-2 text-[13px] font-bold"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-2xl bg-secondary px-3 py-2 text-[13px] font-bold"
          placeholder="Price"
        />
        <input
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-2xl bg-secondary px-3 py-2 text-[13px] font-bold"
          placeholder="Comm %"
        />
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
          {count} member{count === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {plan.status ?? "draft"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run(`save-${plan.id}`, () => updatePlan(plan.id, {
            name,
            price: Number(price) || 0,
            commission_percent: commission === "" ? null : Number(commission),
          }, { role: "admin" }), "Plan updated")}
          disabled={busy === `save-${plan.id}`}
          className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          Save
        </button>
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
        <button
          onClick={() => run(`dl-${plan.id}`, () => deletePlan(plan.id, { role: "admin" }), "Plan archived")}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-bold text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" /> Archive
        </button>
      </div>
    </li>
  );
}
