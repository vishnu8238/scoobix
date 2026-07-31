/**
 * Merchant Manager AI — lead scoring, prioritisation, follow-up suggestions,
 * visit-note summarisation and restaurant health scoring.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { AiPanel, AiText } from "@/components/ai/AiPanel";
import { AiJson } from "@/components/ai/AiJson";
import { useAuth } from "@/lib/auth-store";
import { runAI, useAiTask } from "@/lib/ai/client";
import { listTable } from "@/lib/insforge-crud";
import { getManagerByUser } from "@/lib/manager-api";

export const Route = createFileRoute("/manager/ai")({
  head: () => ({
    meta: [
      { title: "Scoobix Manager · AI Assist" },
      { name: "description", content: "Lead scoring, prioritisation, follow-up suggestions and restaurant health scores for merchant managers." },
      { property: "og:title", content: "Scoobix Manager · AI Assist" },
      { property: "og:description", content: "Work the highest-value leads first with AI scoring and follow-up plans." },
    ],
  }),
  component: ManagerAi,
});

type Lead = Record<string, unknown> & { id?: string; name?: string; status?: string };

function ManagerAi() {
  const { user } = useAuth();
  const [managerId, setManagerId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const m = await getManagerByUser(user.id).catch(() => null);
      if (!m?.id) return;
      setManagerId(m.id);
      const [l, r] = await Promise.all([
        listTable<Lead>("restaurant_leads", { manager_id: `eq.${m.id}`, order: "-created_at", limit: 40 }),
        listTable("restaurants", { manager_id: `eq.${m.id}`, limit: 40 }),
      ]);
      setLeads(l);
      setRestaurants(r);
    })();
  }, [user?.id]);

  const compact = leads.slice(0, 25).map((l) => ({
    leadId: l.id,
    name: l.name,
    status: l.status,
    cuisine: (l as any).cuisine,
    area: (l as any).area ?? (l as any).address,
    phone: Boolean((l as any).phone),
    lastActivity: (l as any).updated_at,
  }));

  const enabled = compact.length > 0;
  const prioritise = useAiTask<any>("lead_prioritize", { leads: compact }, { app: "manager", userId: user?.id, enabled });
  const followups = useAiTask<any>("followup_suggest", { leads: compact }, { app: "manager", userId: user?.id, enabled });
  const health = useAiTask<any>(
    "health_score",
    { restaurants: restaurants.slice(0, 20).map((r: any) => ({ id: r.id, name: r.name, rating: r.rating, is_live: r.is_live, status: r.status })) },
    { app: "manager", userId: user?.id, enabled: restaurants.length > 0 },
  );

  return (
    <div className="mx-auto min-h-svh max-w-[560px] pb-24">
      <PageHeader title="AI Assist" subtitle="Scoring · prioritisation · summaries" />
      <div className="space-y-4 px-4 py-4">
        {!managerId && <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Manager profile not loaded yet.</p>}

        <AiPanel title="Today's lead priority" app="manager" task="lead_prioritize" userId={user?.id} loading={prioritise.loading} res={prioritise.res} onRefresh={prioritise.refresh}>
          <AiJson data={prioritise.data?.ranked ?? prioritise.data} />
        </AiPanel>

        <AiPanel title="Follow-up plan" app="manager" task="followup_suggest" userId={user?.id} loading={followups.loading} res={followups.res} onRefresh={followups.refresh}>
          <AiJson data={followups.data?.actions ?? followups.data} />
        </AiPanel>

        <SingleLeadScore leads={compact} userId={user?.id} />
        <VisitSummary userId={user?.id} />

        <AiPanel title="Restaurant health scores" app="manager" task="health_score" userId={user?.id} loading={health.loading} res={health.res} onRefresh={health.refresh}>
          <AiJson data={health.data} />
        </AiPanel>
      </div>
    </div>
  );
}

function SingleLeadScore({ leads, userId }: { leads: any[]; userId?: string }) {
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<unknown>(null);
  const [potential, setPotential] = useState<unknown>(null);

  const score = async () => {
    const lead = leads.find((l) => String(l.leadId) === sel);
    if (!lead) return toast.error("Pick a lead");
    setBusy(true);
    const [a, b] = await Promise.all([
      runAI("lead_score", lead, { app: "manager", userId }),
      runAI("potential_score", lead, { app: "manager", userId }),
    ]);
    setQuality(a.ok ? a.data : null);
    setPotential(b.ok ? b.data : null);
    setBusy(false);
  };

  return (
    <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <h3 className="text-sm font-bold">Score a lead</h3>
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="mt-2 h-11 w-full rounded-2xl bg-secondary px-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
      >
        <option value="">Select a lead…</option>
        {leads.map((l) => (
          <option key={String(l.leadId)} value={String(l.leadId)}>
            {String(l.name ?? l.leadId)}
          </option>
        ))}
      </select>
      <button
        onClick={score}
        disabled={busy || !sel}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <Wand2 className="h-4 w-4" /> {busy ? "Scoring…" : "Score with AI"}
      </button>
      {quality ? <div className="mt-3"><AiJson data={quality} /></div> : null}
      {potential ? <div className="mt-3 border-t border-border/50 pt-3"><AiJson data={potential} /></div> : null}
    </section>
  );
}

function VisitSummary({ userId }: { userId?: string }) {
  const [notes, setNotes] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!notes.trim()) return;
    setBusy(true);
    const res = await runAI<string>("visit_summary", { notes }, { app: "manager", userId, fresh: true });
    setOut(res.ok ? (typeof res.data === "string" ? res.data : res.text) : "AI unavailable — try again shortly.");
    setBusy(false);
  };

  return (
    <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <h3 className="text-sm font-bold">Summarise visit notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Paste raw notes from the field visit…"
        className="mt-2 w-full rounded-2xl bg-secondary p-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
      />
      <button
        onClick={run}
        disabled={busy || !notes.trim()}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <Wand2 className="h-4 w-4" /> {busy ? "Summarising…" : "Summarise"}
      </button>
      {out && <div className="mt-3"><AiText text={out} /></div>}
    </section>
  );
}
