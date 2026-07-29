import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, Clock3, CheckCircle2, FileEdit, Target, TrendingUp, PlusCircle, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  useManager,
  useManagerRestaurants,
  managerStats,
  onboardingStatus,
  ONBOARDING_LABEL,
  ONBOARDING_TONE,
} from "@/lib/manager-api";
import { useLeads, leadStats } from "@/lib/leads-api";

export const Route = createFileRoute("/manager/")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Dashboard" },
      { name: "description", content: "Track onboarded restaurants, approvals and your monthly target." },
    ],
  }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { user } = useAuth();
  const { manager, loading } = useManager();
  const { list, loading: loadingList } = useManagerRestaurants(manager?.id);
  const stats = managerStats(list, manager?.monthly_target ?? 10);
  const { list: leads, loading: leadLoading } = useLeads(manager?.id);
  const crm = leadStats(leads);

  return (
    <div className="mx-auto max-w-[520px] px-5 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Merchant Manager
          </p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {manager?.name || user?.name || "Manager"}
          </h1>
          {manager?.region && (
            <p className="text-[12px] text-muted-foreground">{manager.region}</p>
          )}
        </div>
        <Link
          to="/manager/onboarding"
          className="inline-flex items-center gap-1.5 rounded-full gradient-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow"
        >
          <PlusCircle className="h-4 w-4" /> Onboard
        </Link>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat icon={Store} label="Onboarded" value={stats.onboarded} />
        <Stat icon={Clock3} label="Pending approval" value={stats.pending} />
        <Stat icon={CheckCircle2} label="Live restaurants" value={stats.live} />
        <Stat icon={FileEdit} label="Draft applications" value={stats.drafts} />
      </div>

      <Link
        to="/manager/leads"
        className="mt-4 flex items-center gap-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Users className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Lead pipeline</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {leadLoading
              ? "Loading leads…"
              : `${crm.open} open · ${crm.overdue} overdue · ${crm.conversionRate}% conversion`}
          </p>
        </div>
        <span className="font-display text-lg font-extrabold">{crm.total}</span>
      </Link>


      <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" strokeWidth={2.6} />
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Monthly target
          </p>
          <span className="ml-auto font-display text-lg font-extrabold">
            {stats.thisMonth}/{stats.target}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full gradient-primary transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          {stats.progress}% of this month's onboarding target
        </p>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Recent applications</h2>
          <Link to="/manager/restaurants" className="text-[11px] font-bold uppercase tracking-wider text-primary">
            View all
          </Link>
        </div>
        <div className="mt-3 space-y-2.5">
          {(loading || loadingList) && (
            <div className="h-20 animate-pulse rounded-3xl bg-muted/60" />
          )}
          {!loading && !loadingList && list.length === 0 && (
            <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
              <p className="text-sm font-semibold">No restaurants yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Start your first onboarding to see it here.
              </p>
            </div>
          )}
          {list.slice(0, 5).map((r) => {
            const s = onboardingStatus(r);
            return (
              <Link
                key={r.id}
                to="/manager/onboarding"
                search={{ id: r.id }}
                className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Store className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.name || "Untitled restaurant"}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {r.rst_code || "ID pending"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ONBOARDING_TONE[s]}`}>
                  {ONBOARDING_LABEL[s]}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <Icon className="h-4 w-4 text-primary" strokeWidth={2.6} />
      <p className="mt-2 font-display text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
