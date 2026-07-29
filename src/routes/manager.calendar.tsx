import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, CalendarClock, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { cn } from "@/lib/format";
import { useManager } from "@/lib/manager-api";
import { useLeads, leadStage, formatWhen, STAGE_LABEL, STAGE_TONE, type Lead } from "@/lib/leads-api";

export const Route = createFileRoute("/manager/calendar")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Meetings & follow-ups" },
      { name: "description", content: "Your meeting calendar and follow-up reminders across all restaurant leads." },
    ],
  }),
  component: ManagerCalendar,
});

type Entry = { lead: Lead; when: string; kind: "meeting" | "followup"; label: string };

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toDateString();
}

function ManagerCalendar() {
  const { manager } = useManager();
  const { list, loading } = useLeads(manager?.id);

  const { groups, overdue } = useMemo(() => {
    const entries: Entry[] = [];
    for (const lead of list) {
      const stage = leadStage(lead);
      if (stage === "lost") continue;
      if (lead.meeting_at)
        entries.push({ lead, when: lead.meeting_at, kind: "meeting", label: lead.meeting_title || "Meeting" });
      if (lead.next_follow_up_at)
        entries.push({ lead, when: lead.next_follow_up_at, kind: "followup", label: "Follow-up call" });
    }
    entries.sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
    const now = Date.now();
    const late = entries.filter((e) => Date.parse(e.when) < now);
    const upcoming = entries.filter((e) => Date.parse(e.when) >= now);
    const map = new Map<string, Entry[]>();
    for (const e of upcoming) {
      const k = dayKey(e.when);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return { groups: [...map.entries()], overdue: late };
  }, [list]);

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="Calendar" subtitle="Meetings & follow-up reminders" />

      <div className="px-5 pt-4">
        {loading && <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />}

        {!loading && overdue.length > 0 && (
          <section className="mb-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-rose-600">
              <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
            </h2>
            <div className="mt-3 space-y-2.5">
              {overdue.map((e, i) => (
                <EntryCard key={`${e.lead.id}-${e.kind}-${i}`} entry={e} overdue />
              ))}
            </div>
          </section>
        )}

        {!loading && groups.length === 0 && overdue.length === 0 && (
          <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
            <p className="text-sm font-semibold">Nothing scheduled</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Set a meeting or follow-up on a lead and it shows up here.
            </p>
          </div>
        )}

        {groups.map(([day, items]) => (
          <section key={day} className="mb-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-bold">
              <CalendarDays className="h-4 w-4 text-primary" />
              {new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short" })}
            </h2>
            <div className="mt-3 space-y-2.5">
              {items.map((e, i) => (
                <EntryCard key={`${e.lead.id}-${e.kind}-${i}`} entry={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function EntryCard({ entry, overdue }: { entry: Entry; overdue?: boolean }) {
  const s = leadStage(entry.lead);
  const Icon = entry.kind === "meeting" ? CalendarDays : CalendarClock;
  return (
    <Link
      to="/manager/lead/$id"
      params={{ id: entry.lead.id }}
      className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60"
    >
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
          overdue ? "bg-rose-100 text-rose-600" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{entry.lead.name || "Untitled lead"}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {entry.label} · {formatWhen(entry.when)}
        </p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", STAGE_TONE[s])}>
        {STAGE_LABEL[s]}
      </span>
    </Link>
  );
}
