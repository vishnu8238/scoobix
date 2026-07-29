import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Phone, Mail, MapPin, CalendarClock, StickyNote, Footprints, PhoneCall,
  CalendarDays, GitBranch, CheckCircle2, Rocket, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/format";
import {
  useLead,
  updateLead,
  removeLead,
  setLeadStage,
  logActivity,
  convertLeadToRestaurant,
  leadStage,
  leadSource,
  fromLocalInput,
  toLocalInput,
  formatWhen,
  LEAD_STAGES,
  STAGE_LABEL,
  STAGE_TONE,
  SOURCE_LABEL,
  ACTIVITY_LABEL,
  type ActivityType,
  type LeadStage,
} from "@/lib/leads-api";

export const Route = createFileRoute("/manager/lead/$id")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Lead details" },
      { name: "description", content: "Lead stage, visit notes, follow-ups, meetings and one-click conversion." },
    ],
  }),
  component: LeadDetail,
});

const ACTIVITY_ICON: Record<ActivityType, typeof StickyNote> = {
  note: StickyNote,
  visit: Footprints,
  call: PhoneCall,
  meeting: CalendarDays,
  stage: GitBranch,
  followup: CalendarClock,
};

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { lead, activities, loading, refresh } = useLead(id);

  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<ActivityType>("visit");
  const [followUp, setFollowUp] = useState("");
  const [meeting, setMeeting] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-[520px] pb-6">
        <PageHeader title="Lead" />
        <div className="px-5 pt-4">
          <div className="h-40 animate-pulse rounded-3xl bg-muted/60" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="mx-auto max-w-[520px] pb-6">
        <PageHeader title="Lead" />
        <div className="px-5 pt-10 text-center">
          <p className="text-sm font-semibold">This lead no longer exists</p>
        </div>
      </div>
    );
  }

  const stage = leadStage(lead);

  const addNote = async () => {
    if (!note.trim()) return toast.error("Write something first");
    setBusy(true);
    await logActivity({
      leadId: lead.id,
      managerId: lead.manager_id,
      type: noteType,
      title: ACTIVITY_LABEL[noteType],
      note: note.trim(),
    });
    setNote("");
    setBusy(false);
    void refresh();
    toast.success("Added to timeline");
  };

  const saveFollowUp = async () => {
    const iso = fromLocalInput(followUp);
    if (!iso) return toast.error("Pick a date and time");
    setBusy(true);
    await updateLead(lead.id, { next_follow_up_at: iso });
    await logActivity({
      leadId: lead.id,
      managerId: lead.manager_id,
      type: "followup",
      title: "Follow-up scheduled",
      dueAt: iso,
    });
    setFollowUp("");
    setBusy(false);
    void refresh();
    toast.success("Follow-up reminder set");
  };

  const saveMeeting = async () => {
    const iso = fromLocalInput(meeting);
    if (!iso) return toast.error("Pick a meeting date and time");
    setBusy(true);
    await updateLead(lead.id, {
      meeting_at: iso,
      meeting_title: meetingTitle.trim() || "Meeting",
      ...(stage === "new" || stage === "contacted" ? { stage: "meeting_scheduled" as LeadStage } : {}),
    });
    await logActivity({
      leadId: lead.id,
      managerId: lead.manager_id,
      type: "meeting",
      title: meetingTitle.trim() || "Meeting scheduled",
      dueAt: iso,
    });
    setMeeting("");
    setMeetingTitle("");
    setBusy(false);
    void refresh();
    toast.success("Meeting added to your calendar");
  };

  const changeStage = async (s: LeadStage) => {
    if (s === stage) return;
    setBusy(true);
    if (s === "onboarded") {
      const res = await convertLeadToRestaurant(lead);
      setBusy(false);
      if (!res.ok) return toast.error(res.message ?? "Conversion failed");
      toast.success("Lead converted — finish the onboarding form");
      return navigate({ to: "/manager/onboarding", search: { id: res.restaurantId } });
    }
    await setLeadStage(lead, s);
    setBusy(false);
    void refresh();
  };

  const convert = async () => {
    setBusy(true);
    const res = await convertLeadToRestaurant(lead);
    setBusy(false);
    if (!res.ok) return toast.error(res.message ?? "Conversion failed");
    toast.success("Restaurant created from lead");
    navigate({ to: "/manager/onboarding", search: { id: res.restaurantId } });
  };

  const drop = async () => {
    setBusy(true);
    await removeLead(lead.id);
    setBusy(false);
    toast.success("Lead deleted");
    navigate({ to: "/manager/leads" });
  };

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title={lead.name || "Lead"} subtitle={SOURCE_LABEL[leadSource(lead)]} />

      <div className="px-5 pt-4">
        <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold">{lead.name}</p>
              <p className="text-[12px] text-muted-foreground">{lead.owner_name || "Owner not captured"}</p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", STAGE_TONE[stage])}>
              {STAGE_LABEL[stage]}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {lead.email}
              </a>
            )}
            {(lead.address || lead.city) && (
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {[lead.address, lead.city].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          {lead.notes && <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-[12px]">{lead.notes}</p>}
        </section>

        {/* Pipeline */}
        <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stage</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LEAD_STAGES.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => changeStage(s)}
                className={cn(
                  "rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition",
                  s === stage ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground",
                )}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>

          {lead.restaurant_id ? (
            <Button
              variant="secondary"
              className="mt-4 w-full rounded-2xl"
              onClick={() => navigate({ to: "/manager/onboarding", search: { id: lead.restaurant_id! } })}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Open onboarding record
            </Button>
          ) : (
            <Button className="mt-4 w-full rounded-2xl" disabled={busy} onClick={convert}>
              <Rocket className="mr-1.5 h-4 w-4" /> Convert to restaurant
            </Button>
          )}
        </section>

        {/* Reminders + meeting */}
        <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Follow-up reminder
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Next: <span className="font-semibold text-foreground">{formatWhen(lead.next_follow_up_at)}</span>
          </p>
          <div className="mt-2.5 flex gap-2">
            <Input
              type="datetime-local"
              value={followUp || toLocalInput(lead.next_follow_up_at)}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <Button className="rounded-2xl" disabled={busy} onClick={saveFollowUp}>
              Set
            </Button>
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Meeting
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {lead.meeting_at ? (
              <>
                <span className="font-semibold text-foreground">{lead.meeting_title || "Meeting"}</span> ·{" "}
                {formatWhen(lead.meeting_at)}
              </>
            ) : (
              "No meeting scheduled"
            )}
          </p>
          <div className="mt-2.5 space-y-2">
            <Input
              placeholder="Meeting title (e.g. menu & commission talk)"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={meeting || toLocalInput(lead.meeting_at)}
                onChange={(e) => setMeeting(e.target.value)}
              />
              <Button className="rounded-2xl" disabled={busy} onClick={saveMeeting}>
                Save
              </Button>
            </div>
          </div>
        </section>

        {/* Visit notes */}
        <section className="mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Add visit note
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["visit", "call", "meeting", "note"] as ActivityType[]).map((t) => (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider",
                  noteType === t ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {ACTIVITY_LABEL[t]}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-2.5"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened during this interaction?"
          />
          <Button className="mt-2.5 w-full rounded-2xl" disabled={busy} onClick={addNote}>
            Add to timeline
          </Button>
        </section>

        {/* Timeline */}
        <section className="mt-4">
          <h2 className="font-display text-base font-bold">Timeline</h2>
          <ol className="relative mt-3 space-y-4 pl-7">
            <span className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" aria-hidden />
            {activities.length === 0 && (
              <li className="text-[12px] text-muted-foreground">No activity recorded yet.</li>
            )}
            {activities.map((a) => {
              const type = (a.type ?? "note") as ActivityType;
              const Icon = ACTIVITY_ICON[type] ?? StickyNote;
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-7 top-0 grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-primary ring-4 ring-background">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-semibold">{a.title || ACTIVITY_LABEL[type]}</p>
                  {a.note && <p className="text-[12px] text-muted-foreground">{a.note}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {formatWhen(a.created_at)}
                    {a.due_at ? ` · due ${formatWhen(a.due_at)}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <button
          onClick={drop}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-3xl bg-muted p-4 text-sm font-bold text-muted-foreground"
        >
          <Trash2 className="h-4 w-4" /> Delete lead
        </button>
      </div>
    </div>
  );
}
