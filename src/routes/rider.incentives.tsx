import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Target, TrendingUp, Trophy, Wallet } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useDriver } from "@/lib/driver-store";
import { formatPrice } from "@/lib/format";
import { useLiveData } from "@/lib/realtime-hooks";
import {
  listRiderIncentives, riderIncentiveSummary, RIDER_INCENTIVE_LABEL,
  periodKey, type RiderIncentive,
} from "@/lib/subscriptions-api";

export const Route = createFileRoute("/rider/incentives")({
  head: () => ({
    meta: [
      { title: "Scoobix Rider · Incentives & bonuses" },
      { name: "description", content: "Track peak-hour, daily and weekly rider incentives, targets achieved and paid vs pending payouts." },
    ],
  }),
  component: RiderIncentives,
});

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  approved: "bg-sky-100 text-sky-700",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
};

function RiderIncentives() {
  const { driverId, loading: driverLoading } = useDriver();
  const { data, loading } = useLiveData<RiderIncentive[]>(
    ["rider_incentives"],
    () => (driverId ? listRiderIncentives(driverId) : Promise.resolve([])),
    [driverId],
  );
  const rows = data ?? [];
  const summary = useMemo(() => riderIncentiveSummary(rows), [rows]);
  const active = rows.filter((r) => r.period === periodKey() && r.status !== "rejected");

  if (driverLoading || loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Incentives" subtitle="Targets, bonuses & payouts" />

      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Paid out", value: formatPrice(summary.paid), icon: Wallet },
          { label: "Pending", value: formatPrice(summary.pending), icon: Trophy },
          { label: "Orders counted", value: String(summary.ordersCompleted), icon: Target },
          { label: "Online hours", value: `${summary.onlineHours} h`, icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 font-display text-lg font-extrabold">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Performance</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <p className="text-muted-foreground">Acceptance rate</p>
            <p className="font-display text-base font-extrabold">{summary.acceptanceRate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completion rate</p>
            <p className="font-display text-base font-extrabold">{summary.completionRate}%</p>
          </div>
        </div>
      </section>

      <h3 className="mx-4 mt-6 font-display text-base font-extrabold">This period</h3>
      {active.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-9 w-9" />}
          title="No active incentives"
          description="New bonus targets appear here as soon as Scoobix publishes them for your city."
        />
      ) : (
        <ul className="mx-4 mt-3 space-y-3">
          {active.map((r) => {
            const target = Number(r.target ?? 0);
            const achieved = Number(r.achieved ?? 0);
            const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
            return (
              <li key={r.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-extrabold">
                      {RIDER_INCENTIVE_LABEL[r.type ?? ""] ?? r.type ?? "Bonus"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {achieved} of {target || "—"} completed
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-extrabold text-primary">{formatPrice(r.amount ?? 0)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[r.status ?? "pending"]}`}>
                      {r.status ?? "pending"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                {pct >= 100 && <p className="mt-1.5 text-[11px] font-bold text-emerald-600">Target achieved 🎉</p>}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mx-4 mt-6 font-display text-base font-extrabold">History</h3>
      {rows.length === 0 ? (
        <p className="mx-4 mt-2 text-xs text-muted-foreground">No incentive records yet.</p>
      ) : (
        <ul className="mx-4 mt-2 divide-y divide-border/60 rounded-3xl bg-card px-4 shadow-soft ring-1 ring-border/60">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-[12.5px]">
              <div className="min-w-0">
                <p className="truncate font-semibold">{RIDER_INCENTIVE_LABEL[r.type ?? ""] ?? r.type}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.period} {r.paid_at ? `· paid ${new Date(r.paid_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">{formatPrice(r.amount ?? 0)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
