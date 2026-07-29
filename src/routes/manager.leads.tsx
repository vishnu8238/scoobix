import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Phone, CalendarClock, AlertTriangle, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/format";
import { useManager } from "@/lib/manager-api";
import {
  useLeads,
  createLead,
  leadStage,
  leadSource,
  leadStats,
  fromLocalInput,
  formatWhen,
  LEAD_STAGES,
  LEAD_SOURCES,
  STAGE_LABEL,
  STAGE_TONE,
  SOURCE_LABEL,
  type LeadStage,
  type LeadSource,
} from "@/lib/leads-api";

export const Route = createFileRoute("/manager/leads")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Restaurant leads" },
      { name: "description", content: "Track restaurant leads, stages, follow-ups and conversions." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { manager } = useManager();
  const { list, loading, refresh } = useLeads(manager?.id);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [open, setOpen] = useState(false);

  const stats = leadStats(list);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((l) => {
      if (stage !== "all" && leadStage(l) !== stage) return false;
      if (!needle) return true;
      return [l.name, l.owner_name, l.phone, l.city, l.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [list, q, stage]);

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader
        title="Leads"
        subtitle="Restaurant CRM pipeline"
        back={false}
        right={
          <button
            onClick={() => setOpen(true)}
            aria-label="Add lead"
            className="grid h-10 w-10 place-items-center rounded-full gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        }
      />

      <div className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Metric label="Open" value={stats.open} />
          <Metric label="Converted" value={stats.won} />
          <Metric label="Overdue" value={stats.overdue} tone={stats.overdue ? "text-rose-600" : undefined} />
        </div>

        <div className="mt-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" strokeWidth={2.6} />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Conversion rate
            </p>
            <span className="ml-auto font-display text-lg font-extrabold">{stats.conversionRate}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${stats.conversionRate}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {stats.won} onboarded · {stats.lost} lost · {stats.total} total leads
            {stats.closeRate ? ` · ${stats.closeRate}% win rate on closed leads` : ""}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, owner, phone, city"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          <Chip active={stage === "all"} onClick={() => setStage("all")}>
            All · {list.length}
          </Chip>
          {LEAD_STAGES.map((s) => {
            const count = stats.byStage.find((b) => b.stage === s)?.count ?? 0;
            return (
              <Chip key={s} active={stage === s} onClick={() => setStage(s)}>
                {STAGE_LABEL[s]} · {count}
              </Chip>
            );
          })}
        </div>

        <div className="mt-4 space-y-2.5">
          {loading && <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />}
          {!loading && filtered.length === 0 && (
            <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
              <p className="text-sm font-semibold">No leads here yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Add a restaurant lead to start tracking conversations.
              </p>
            </div>
          )}
          {filtered.map((l) => {
            const s = leadStage(l);
            const overdue =
              l.next_follow_up_at &&
              Date.parse(l.next_follow_up_at) < Date.now() &&
              s !== "onboarded" &&
              s !== "lost";
            return (
              <Link
                key={l.id}
                to="/manager/lead/$id"
                params={{ id: l.id }}
                className="block rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{l.name || "Untitled lead"}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {l.owner_name || "No owner"}
                      {l.city ? ` · ${l.city}` : ""} · {SOURCE_LABEL[leadSource(l)]}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", STAGE_TONE[s])}>
                    {STAGE_LABEL[s]}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  {l.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {l.phone}
                    </span>
                  )}
                  {l.next_follow_up_at && (
                    <span className={cn("inline-flex items-center gap-1", overdue && "font-bold text-rose-600")}>
                      {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      {formatWhen(l.next_follow_up_at)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {open && (
        <NewLeadSheet
          managerId={manager?.id}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-3xl bg-card p-3.5 text-center shadow-soft ring-1 ring-border/60">
      <p className={cn("font-display text-xl font-extrabold", tone)}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition",
        active ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NewLeadSheet({
  managerId,
  onClose,
  onSaved,
}: {
  managerId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    owner_name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    cuisine: "",
    source: "walk_in" as LeadSource,
    stage: "new" as LeadStage,
    next_follow_up_at: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Restaurant name is required");
    if (!managerId) return toast.error("Your manager profile is still loading");
    setBusy(true);
    const row = await createLead({
      manager_id: managerId,
      name: form.name.trim(),
      owner_name: form.owner_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      cuisine: form.cuisine.trim() || null,
      source: form.source,
      stage: form.stage,
      notes: form.notes.trim() || null,
      next_follow_up_at: fromLocalInput(form.next_follow_up_at),
    });
    setBusy(false);
    if (!row) return toast.error("Could not save the lead");
    toast.success("Lead added");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="max-h-[88svh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">New restaurant lead</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Restaurant name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Owner name" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </div>
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Cuisine" value={form.cuisine} onChange={(v) => setForm({ ...form, cuisine: v })} />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEAD_SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, source: s })}
                  className={cn(
                    "rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider",
                    form.source === s ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {SOURCE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Follow-up reminder
            </Label>
            <Input
              type="datetime-local"
              className="mt-1.5"
              value={form.next_follow_up_at}
              onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="First impression, expectations, competitor apps…"
            />
          </div>

          <Button className="w-full rounded-2xl" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Add lead"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input className="mt-1.5" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
