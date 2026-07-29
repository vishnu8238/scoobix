/**
 * Restaurant Lead Management (CRM) for the Merchant Manager app.
 *
 * 100% InsForge — tables:
 *  - restaurant_leads  (lead record + stage + source + follow-up / meeting)
 *  - lead_activities   (notes, visits, calls, meetings, stage changes, reminders)
 */
import { useCallback, useEffect, useState } from "react";
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { saveOnboardingDraft, logOnboardingEvent, nextRstCode } from "./manager-api";

export type LeadStage =
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "documentation_pending"
  | "negotiation"
  | "ready_to_onboard"
  | "onboarded"
  | "lost";

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "meeting_scheduled",
  "documentation_pending",
  "negotiation",
  "ready_to_onboard",
  "onboarded",
  "lost",
];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  meeting_scheduled: "Meeting scheduled",
  documentation_pending: "Documentation pending",
  negotiation: "Negotiation",
  ready_to_onboard: "Ready to onboard",
  onboarded: "Onboarded",
  lost: "Lost",
};

export const STAGE_TONE: Record<LeadStage, string> = {
  new: "bg-sky-100 text-sky-700",
  contacted: "bg-blue-100 text-blue-700",
  meeting_scheduled: "bg-violet-100 text-violet-700",
  documentation_pending: "bg-amber-100 text-amber-700",
  negotiation: "bg-orange-100 text-orange-700",
  ready_to_onboard: "bg-emerald-100 text-emerald-700",
  onboarded: "bg-primary-soft text-primary",
  lost: "bg-rose-100 text-rose-700",
};

export type LeadSource = "walk_in" | "referral" | "cold_call" | "campaign" | "website";

export const LEAD_SOURCES: LeadSource[] = ["walk_in", "referral", "cold_call", "campaign", "website"];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  cold_call: "Cold call",
  campaign: "Campaign",
  website: "Website",
};

export type LeadPriority = "low" | "medium" | "high";

export type Lead = {
  id: string;
  manager_id?: string | null;
  name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  cuisine?: string | null;
  stage?: LeadStage | string | null;
  source?: LeadSource | string | null;
  priority?: LeadPriority | string | null;
  notes?: string | null;
  next_follow_up_at?: string | null;
  meeting_at?: string | null;
  meeting_title?: string | null;
  lost_reason?: string | null;
  restaurant_id?: string | null;
  converted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ActivityType = "note" | "visit" | "call" | "meeting" | "stage" | "followup";

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  note: "Note",
  visit: "Visit",
  call: "Call",
  meeting: "Meeting",
  stage: "Stage change",
  followup: "Follow-up",
};

export type LeadActivity = {
  id: string;
  lead_id?: string | null;
  manager_id?: string | null;
  type?: ActivityType | string | null;
  title?: string | null;
  note?: string | null;
  stage?: string | null;
  due_at?: string | null;
  completed?: boolean | null;
  created_at?: string | null;
};

export function leadStage(l: Lead): LeadStage {
  const s = (l.stage ?? "new") as LeadStage;
  return LEAD_STAGES.includes(s) ? s : "new";
}

export function leadSource(l: Lead): LeadSource {
  const s = (l.source ?? "walk_in") as LeadSource;
  return LEAD_SOURCES.includes(s) ? s : "walk_in";
}

// ---------- CRUD ----------

export async function listLeads(managerId: string): Promise<Lead[]> {
  if (!managerId) return [];
  return listTable<Lead>("restaurant_leads", {
    manager_id: `eq.${managerId}`,
    order: "created_at.desc",
    limit: 500,
  });
}

export async function getLead(id: string): Promise<Lead | null> {
  const rows = await listTable<Lead>("restaurant_leads", { id: `eq.${id}`, limit: 1 });
  return rows[0] ?? null;
}

export async function createLead(input: Partial<Lead> & { manager_id: string; name: string }) {
  const created = await createRecord<Lead[] | Lead>("restaurant_leads", {
    stage: "new",
    source: "walk_in",
    priority: "medium",
    ...input,
    created_at: new Date().toISOString(),
  } as Record<string, unknown>);
  const row = (Array.isArray(created) ? created[0] : created) as Lead | null;
  if (row?.id) {
    await logActivity({
      leadId: row.id,
      managerId: input.manager_id,
      type: "stage",
      title: "Lead created",
      stage: String(input.stage ?? "new"),
    });
  }
  return row;
}

export async function updateLead(id: string, patch: Partial<Lead>) {
  await patchRecord("restaurant_leads", id, {
    ...patch,
    updated_at: new Date().toISOString(),
  } as Record<string, unknown>);
}

export async function removeLead(id: string) {
  await deleteRecord("restaurant_leads", id);
}

export async function setLeadStage(lead: Lead, stage: LeadStage, note?: string) {
  await updateLead(lead.id, { stage, ...(stage === "lost" ? { lost_reason: note ?? null } : {}) });
  await logActivity({
    leadId: lead.id,
    managerId: lead.manager_id ?? null,
    type: "stage",
    title: `Moved to ${STAGE_LABEL[stage]}`,
    note,
    stage,
  });
}

// ---------- activities / timeline ----------

export async function logActivity(input: {
  leadId: string;
  managerId?: string | null;
  type: ActivityType;
  title?: string;
  note?: string;
  stage?: string;
  dueAt?: string | null;
}) {
  await createRecord("lead_activities", {
    lead_id: input.leadId,
    manager_id: input.managerId ?? null,
    type: input.type,
    title: input.title ?? null,
    note: input.note ?? null,
    stage: input.stage ?? null,
    due_at: input.dueAt ?? null,
    completed: false,
    created_at: new Date().toISOString(),
  });
}

export async function listActivities(leadId: string): Promise<LeadActivity[]> {
  if (!leadId) return [];
  return listTable<LeadActivity>("lead_activities", {
    lead_id: `eq.${leadId}`,
    order: "created_at.desc",
    limit: 300,
  });
}

export async function listManagerActivities(managerId: string): Promise<LeadActivity[]> {
  if (!managerId) return [];
  return listTable<LeadActivity>("lead_activities", {
    manager_id: `eq.${managerId}`,
    order: "created_at.desc",
    limit: 500,
  });
}

export async function completeActivity(id: string) {
  await patchRecord("lead_activities", id, { completed: true });
}

// ---------- conversion ----------

/**
 * One-click convert: creates the restaurant onboarding draft from the lead,
 * links it back, and marks the lead as onboarded.
 */
export async function convertLeadToRestaurant(lead: Lead): Promise<{ ok: boolean; restaurantId?: string; message?: string }> {
  if (!lead.manager_id) return { ok: false, message: "Manager profile missing" };
  if (lead.restaurant_id) return { ok: true, restaurantId: lead.restaurant_id };

  const rst = await nextRstCode();
  const saved = await saveOnboardingDraft(null, {
    name: lead.name ?? "Untitled restaurant",
    cuisine: lead.cuisine ?? null,
    owner_name: lead.owner_name ?? null,
    owner_phone: lead.phone ?? null,
    owner_email: lead.email ?? null,
    contact_phone: lead.phone ?? null,
    contact_email: lead.email ?? null,
    address: lead.address ?? null,
    city: lead.city ?? null,
    rst_code: rst,
    manager_id: lead.manager_id,
    onboarded_by: lead.manager_id,
    onboarding_status: "draft",
    status: "pending",
  });
  if (!saved?.id) return { ok: false, message: "Could not create the restaurant record" };

  await logOnboardingEvent({
    restaurantId: saved.id,
    managerId: lead.manager_id,
    status: "draft",
    note: `Converted from lead: ${lead.name ?? ""}`,
  });
  await updateLead(lead.id, {
    stage: "onboarded",
    restaurant_id: saved.id,
    converted_at: new Date().toISOString(),
  });
  await logActivity({
    leadId: lead.id,
    managerId: lead.manager_id,
    type: "stage",
    title: "Converted to restaurant",
    note: rst,
    stage: "onboarded",
  });
  return { ok: true, restaurantId: saved.id };
}

// ---------- stats ----------

export function leadStats(list: Lead[]) {
  const by = (s: LeadStage) => list.filter((l) => leadStage(l) === s).length;
  const total = list.length;
  const won = by("onboarded");
  const lost = by("lost");
  const closed = won + lost;
  const now = Date.now();
  const overdue = list.filter(
    (l) => l.next_follow_up_at && Date.parse(l.next_follow_up_at) < now && leadStage(l) !== "onboarded" && leadStage(l) !== "lost",
  ).length;
  return {
    total,
    won,
    lost,
    open: total - closed,
    overdue,
    conversionRate: total ? Math.round((won / total) * 100) : 0,
    closeRate: closed ? Math.round((won / closed) * 100) : 0,
    byStage: LEAD_STAGES.map((s) => ({ stage: s, count: by(s) })),
  };
}

// ---------- hooks ----------

export function useLeads(managerId?: string | null) {
  const [list, setList] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!managerId) { setList([]); setLoading(false); return; }
    setLoading(true);
    setList(await listLeads(managerId));
    setLoading(false);
  }, [managerId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { list, loading, refresh };
}

export function useLead(id?: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) { setLead(null); setActivities([]); setLoading(false); return; }
    setLoading(true);
    const [l, a] = await Promise.all([getLead(id), listActivities(id)]);
    setLead(l);
    setActivities(a);
    setLoading(false);
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { lead, activities, loading, refresh };
}

// ---------- helpers ----------

export function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
