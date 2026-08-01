import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Award, Loader2, Store, Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useManager } from "@/lib/manager-api";
import { formatPrice } from "@/lib/format";
import { useLiveData } from "@/lib/realtime-hooks";
import {
  listMerchantTargets, managerPerformance, periodKey, type MerchantTarget,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/manager/targets")({
  head: () => ({
    meta: [
      { title: "Scoobix Manager · Targets & incentives" },
      { name: "description", content: "Monthly onboarding targets, attainment, commission and regional growth for merchant managers." },
    ],
  }),
  component: ManagerTargets,
});

function ManagerTargets() {
  const { manager, loading: managerLoading } = useManager();
  const { data, loading } = useLiveData<MerchantTarget[]>(
    ["merchant_targets"],
    () => (manager?.id ? listMerchantTargets(manager.id) : Promise.resolve([])),
    [manager?.id],
  );
  const rows = data ?? [];
  const perf = useMemo(() => managerPerformance(rows), [rows]);

  if (managerLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-[720px] pb-24">
      <PageHeader title="My targets" subtitle={manager?.name ?? "Performance & incentives"} />

      <section className="mx-4 mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {periodKey()} {perf.region ? `· ${perf.region}` : ""}
          </p>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
            {perf.attainment}% attained
          </span>
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold">
          {perf.achieved} <span className="text-base text-muted-foreground">of {perf.target || "—"} restaurants live</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, perf.attainment)}%` }} />
        </div>
      </section>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Commission earned", value: formatPrice(perf.commission), icon: Award },
          { label: "Bonus earned", value: formatPrice(perf.bonus), icon: Target },
          { label: "Assigned restaurants", value: String(perf.current?.assigned_restaurants ?? 0), icon: Store },
          { label: "Regional growth", value: `${perf.growth}%`, icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-display text-lg font-extrabold">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <h3 className="mx-4 mt-6 font-display text-base font-extrabold">Target history</h3>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Target className="h-9 w-9" />}
          title="No targets assigned"
          description="Your monthly onboarding targets appear here once the admin team assigns them."
        />
      ) : (
        <ul className="mx-4 mt-3 divide-y divide-border/60 rounded-3xl bg-card px-4 shadow-soft ring-1 ring-border/60">
          {rows.map((r) => {
            const t = Number(r.target ?? 0);
            const a = Number(r.achieved ?? 0);
            const pct = t > 0 ? Math.round((a / t) * 100) : 0;
            return (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-3 text-[12.5px]">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.period} {r.region ? `· ${r.region}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a}/{t || "—"} live · {r.live_restaurants ?? 0} active outlets
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{formatPrice(Number(r.commission ?? 0) + Number(r.bonus ?? 0))}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${pct >= 100 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {pct}%
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
