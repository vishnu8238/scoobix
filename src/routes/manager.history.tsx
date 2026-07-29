import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import {
  useManager,
  useManagerRestaurants,
  listOnboardingHistory,
  ONBOARDING_LABEL,
  ONBOARDING_TONE,
  type OnboardingEvent,
  type OnboardingStatus,
} from "@/lib/manager-api";

export const Route = createFileRoute("/manager/history")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Onboarding history" },
      { name: "description", content: "Full audit trail of every onboarding status change you made." },
    ],
  }),
  component: ManagerHistory,
});

function ManagerHistory() {
  const { manager } = useManager();
  const { list } = useManagerRestaurants(manager?.id);
  const [events, setEvents] = useState<OnboardingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!manager?.id) { setEvents([]); setLoading(false); return; }
      const rows = await listOnboardingHistory(undefined, manager.id);
      if (!cancelled) { setEvents(rows); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [manager?.id]);

  const nameFor = (id?: string | null) =>
    list.find((r) => r.id === id)?.name ?? list.find((r) => r.id === id)?.rst_code ?? "Restaurant";

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="Onboarding history" subtitle={`${events.length} events`} back={false} />
      <div className="px-5 pt-4">
        {loading && <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />}
        {!loading && events.length === 0 && (
          <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
            <HistoryIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">No history yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Every save, submission and admin decision is logged here.
            </p>
          </div>
        )}
        <div className="space-y-2.5">
          {events.map((e) => {
            const s = (e.status ?? "draft") as OnboardingStatus;
            return (
              <div key={e.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{nameFor(e.restaurant_id)}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ONBOARDING_TONE[s] ?? "bg-muted text-muted-foreground"}`}>
                    {ONBOARDING_LABEL[s] ?? e.status}
                  </span>
                </div>
                {e.note && <p className="mt-1.5 text-[12px] text-muted-foreground">{e.note}</p>}
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {e.actor_role ?? "manager"} · {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
