import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import {
  useManager,
  useManagerRestaurants,
} from "@/lib/manager-api";
import {
  listAllTickets,
  ticketStatus,
  STATUS_LABEL,
  STATUS_TONE,
  PRIORITY_TONE,
  type SupportTicket,
} from "@/lib/support-api";

export const Route = createFileRoute("/manager/support")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Restaurant support" },
      { name: "description", content: "Support tickets raised by the restaurants assigned to you." },
    ],
  }),
  component: ManagerSupport,
});

function ManagerSupport() {
  const { manager } = useManager();
  const { list: restaurants } = useManagerRestaurants(manager?.id);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!manager?.id) return;
      const all = await listAllTickets();
      if (cancelled) return;
      const owners = new Set(restaurants.map((r) => r.owner_id).filter(Boolean) as string[]);
      const ids = new Set(restaurants.map((r) => r.id));
      setTickets(
        all.filter(
          (t) =>
            (t.created_by && owners.has(t.created_by)) ||
            (t.reference_id && ids.has(t.reference_id)),
        ),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [manager?.id, restaurants]);

  const nameFor = (t: SupportTicket) =>
    restaurants.find((r) => r.owner_id === t.created_by || r.id === t.reference_id)?.name ??
    t.contact_name ??
    "Restaurant";

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="Restaurant support" subtitle={`${tickets.length} tickets`} />
      <div className="px-5 pt-4 space-y-2.5">
        {loading && <div className="h-20 animate-pulse rounded-3xl bg-muted/60" />}
        {!loading && tickets.length === 0 && (
          <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
            <LifeBuoy className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">No open tickets</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Tickets raised by your assigned restaurants will appear here.
            </p>
          </div>
        )}
        {tickets.map((t) => {
          const s = ticketStatus(t);
          return (
            <div key={t.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{t.title}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[s]}`}>
                  {STATUS_LABEL[s]}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {nameFor(t)} · {t.ticket_code}
              </p>
              {t.description && (
                <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">{t.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_TONE[String(t.priority ?? "normal")]}`}>
                  {String(t.priority ?? "normal")}
                </span>
                {t.contact_phone && (
                  <a href={`tel:${t.contact_phone}`} className="text-[11px] font-bold text-primary">
                    Call restaurant
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
