/**
 * Scoobix Support Center — omnichannel ticketing, fully InsForge backed.
 *
 * Tables
 *  - `support_tickets`          one row per ticket (any role)
 *  - `support_ticket_messages`  conversation thread + internal notes
 *  - `ticket_attachments`       images / documents on a ticket or message
 *  - `ticket_activity`          immutable activity + audit log
 *  - `ticket_assignments`       assignment / transfer history
 *  - `ticket_ratings`           customer satisfaction after closure
 *
 * Realtime: every write goes through `insforge-crud`, which publishes on
 * `db:<table>` plus the scoped `ticket:<id>` channel, so replies land without
 * a refresh. All calls are best-effort — the CRUD layer never throws.
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";

/* ------------------------------------------------------------------ model */

export type TicketStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "waiting_customer"
  | "waiting_restaurant"
  | "waiting_rider"
  | "resolved"
  | "closed"
  | "reopened";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

/** `manager` / `admin` raise tickets too (internal escalations). */
export type TicketRole = "customer" | "restaurant" | "driver" | "manager" | "admin";

export type TicketCategory =
  | "orders"
  | "payments"
  | "delivery"
  | "restaurant"
  | "account"
  | "kyc"
  | "wallet"
  | "coupons"
  | "offers"
  | "technical"
  | "feature_request"
  | "bug_report"
  | "other";

export type SupportTicket = {
  id: string;
  ticket_code?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  attachments?: string[] | string | null;
  priority?: TicketPriority | string | null;
  created_by?: string | null;
  role?: string | null;
  status?: TicketStatus | string | null;
  assigned_admin?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  restaurant_id?: string | null;
  driver_id?: string | null;
  order_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  reference_id?: string | null;
  escalated?: boolean | null;
  escalated_at?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  sla_due_at?: string | null;
  sla_breached?: boolean | null;
  merged_into?: string | null;
  reopen_count?: number | null;
  last_message_at?: string | null;
  unread_for_owner?: number | null;
  unread_for_agent?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TicketMessage = {
  id: string;
  ticket_id?: string | null;
  author_id?: string | null;
  author_role?: string | null;
  author_name?: string | null;
  message?: string | null;
  internal?: boolean | null;
  attachments?: string[] | string | null;
  created_at?: string | null;
};

export type TicketAttachment = {
  id: string;
  ticket_id?: string | null;
  message_id?: string | null;
  uploaded_by?: string | null;
  uploader_role?: string | null;
  url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  kind?: string | null;
  created_at?: string | null;
};

export type TicketActivity = {
  id: string;
  ticket_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  actor_name?: string | null;
  action?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export type TicketAssignment = {
  id: string;
  ticket_id?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_role?: string | null;
  assigned_by?: string | null;
  reason?: string | null;
  active?: boolean | null;
  released_at?: string | null;
  created_at?: string | null;
};

export type TicketRating = {
  id: string;
  ticket_id?: string | null;
  user_id?: string | null;
  rating?: number | null;
  comment?: string | null;
  agent_id?: string | null;
  created_at?: string | null;
};

/* --------------------------------------------------------------- catalogue */

export const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "waiting_customer",
  "waiting_restaurant",
  "waiting_rider",
  "resolved",
  "closed",
  "reopened",
];

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  waiting_customer: "Waiting for Customer",
  waiting_restaurant: "Waiting for Restaurant",
  waiting_rider: "Waiting for Rider",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
  // legacy rows written before the Support Center pass
  waiting: "Waiting for Customer",
};

export const STATUS_TONE: Record<string, string> = {
  open: "bg-sky-100 text-sky-700",
  assigned: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting_customer: "bg-violet-100 text-violet-700",
  waiting_restaurant: "bg-violet-100 text-violet-700",
  waiting_rider: "bg-violet-100 text-violet-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-zinc-200 text-zinc-700",
  reopened: "bg-rose-100 text-rose-700",
  waiting: "bg-violet-100 text-violet-700",
};

export const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
  normal: "Medium",
};

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600",
  medium: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
  normal: "bg-sky-100 text-sky-700",
};

export const TICKET_CATEGORIES: TicketCategory[] = [
  "orders",
  "payments",
  "delivery",
  "restaurant",
  "account",
  "kyc",
  "wallet",
  "coupons",
  "offers",
  "technical",
  "feature_request",
  "bug_report",
  "other",
];

export const CATEGORY_LABEL: Record<string, string> = {
  orders: "Orders",
  payments: "Payments",
  delivery: "Delivery",
  restaurant: "Restaurant",
  account: "Account",
  kyc: "KYC",
  wallet: "Wallet",
  coupons: "Coupons",
  offers: "Offers",
  technical: "Technical Issue",
  feature_request: "Feature Request",
  bug_report: "Bug Report",
  other: "Other",
};

/** Suggested priority per category — the user can still override it. */
const CATEGORY_PRIORITY: Record<TicketCategory, TicketPriority> = {
  orders: "high",
  payments: "urgent",
  delivery: "high",
  restaurant: "medium",
  account: "medium",
  kyc: "high",
  wallet: "urgent",
  coupons: "low",
  offers: "low",
  technical: "high",
  feature_request: "low",
  bug_report: "medium",
  other: "medium",
};

export function suggestPriority(category: TicketCategory | string): TicketPriority {
  return CATEGORY_PRIORITY[(category as TicketCategory) ?? "other"] ?? "medium";
}

/** First-response SLA, in hours, per priority. */
export const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 1,
  high: 4,
  medium: 12,
  low: 24,
};

/** Escalation timer — a ticket untouched for this long should be escalated. */
export const ESCALATE_HOURS: Record<TicketPriority, number> = {
  urgent: 2,
  high: 8,
  medium: 24,
  low: 48,
};

const OPEN_STATUSES = new Set<string>([
  "open",
  "assigned",
  "in_progress",
  "waiting_customer",
  "waiting_restaurant",
  "waiting_rider",
  "reopened",
  "waiting",
]);

/* ------------------------------------------------------------- normalisers */

export function ticketStatus(t: SupportTicket): TicketStatus {
  const s = String(t.status ?? "open");
  if (s === "waiting") return "waiting_customer";
  return (TICKET_STATUSES as string[]).includes(s) ? (s as TicketStatus) : "open";
}

export function ticketPriority(t: SupportTicket): TicketPriority {
  const p = String(t.priority ?? "medium");
  if (p === "normal") return "medium";
  return (TICKET_PRIORITIES as string[]).includes(p) ? (p as TicketPriority) : "medium";
}

export function ticketCategory(t: SupportTicket): TicketCategory {
  const c = String(t.category ?? "other");
  return (TICKET_CATEGORIES as string[]).includes(c) ? (c as TicketCategory) : "other";
}

export function isTicketOpen(t: SupportTicket): boolean {
  return OPEN_STATUSES.has(String(t.status ?? "open"));
}

export function ticketAttachments(t: SupportTicket | TicketMessage): string[] {
  const a = t.attachments;
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean) as string[];
  try {
    const parsed = JSON.parse(a as string);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function hoursSince(iso?: string | null): number {
  if (!iso) return 0;
  return (Date.now() - Date.parse(iso)) / 3_600_000;
}

/** SLA state of a ticket, derived (never stale) from its timestamps. */
export function ticketSla(t: SupportTicket): {
  dueAt: number | null;
  overdue: boolean;
  breached: boolean;
  firstResponseMins: number | null;
  resolutionMins: number | null;
  escalateDue: boolean;
} {
  const priority = ticketPriority(t);
  const created = t.created_at ? Date.parse(t.created_at) : null;
  const dueAt = created ? created + SLA_HOURS[priority] * 3_600_000 : null;
  const firstResponseMins =
    t.first_response_at && created
      ? Math.max(0, Math.round((Date.parse(t.first_response_at) - created) / 60000))
      : null;
  const resolutionMins =
    (t.resolved_at || t.closed_at) && created
      ? Math.max(0, Math.round((Date.parse((t.resolved_at ?? t.closed_at)!) - created) / 60000))
      : null;
  const open = isTicketOpen(t);
  const overdue = !!dueAt && open && !t.first_response_at && Date.now() > dueAt;
  const breached =
    !!t.sla_breached ||
    overdue ||
    (firstResponseMins !== null && firstResponseMins > SLA_HOURS[priority] * 60);
  const escalateDue =
    open && !t.escalated && hoursSince(t.last_message_at ?? t.created_at) > ESCALATE_HOURS[priority];
  return { dueAt, overdue, breached, firstResponseMins, resolutionMins, escalateDue };
}

function newTicketCode() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TKT-${stamp}-${rand}`;
}

/* ------------------------------------------------------------------ notify */

async function notify(userId: string | null | undefined, title: string, message: string) {
  if (!userId) return;
  await createRecord("notifications", {
    user_id: userId,
    title,
    message,
    body: message,
    kind: "system",
    unread: true,
    read_status: false,
  });
}

/* ------------------------------------------------------------------- reads */

/** Tickets raised by one user (their own support screen). */
export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  if (!userId) return [];
  return listTable<SupportTicket>("support_tickets", {
    created_by: `eq.${userId}`,
    order: "created_at.desc",
    limit: 200,
  });
}

/** Every ticket (admin dashboard). */
export async function listAllTickets(): Promise<SupportTicket[]> {
  return listTable<SupportTicket>("support_tickets", { order: "created_at.desc", limit: 500 });
}

export async function listTicketMessages(
  ticketId: string,
  opts: { includeInternal?: boolean } = {},
): Promise<TicketMessage[]> {
  if (!ticketId) return [];
  const rows = await listTable<TicketMessage>("support_ticket_messages", {
    ticket_id: `eq.${ticketId}`,
    order: "created_at.asc",
    limit: 300,
  });
  return opts.includeInternal ? rows : rows.filter((m) => !m.internal);
}

export async function listTicketActivity(ticketId: string): Promise<TicketActivity[]> {
  if (!ticketId) return [];
  return listTable<TicketActivity>("ticket_activity", {
    ticket_id: `eq.${ticketId}`,
    order: "created_at.desc",
    limit: 200,
  });
}

export async function listTicketAssignments(ticketId: string): Promise<TicketAssignment[]> {
  if (!ticketId) return [];
  return listTable<TicketAssignment>("ticket_assignments", {
    ticket_id: `eq.${ticketId}`,
    order: "created_at.desc",
    limit: 50,
  });
}

export async function listTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (!ticketId) return [];
  return listTable<TicketAttachment>("ticket_attachments", {
    ticket_id: `eq.${ticketId}`,
    order: "created_at.asc",
    limit: 100,
  });
}

export async function getTicketRating(ticketId: string): Promise<TicketRating | null> {
  if (!ticketId) return [] && null;
  const rows = await listTable<TicketRating>("ticket_ratings", {
    ticket_id: `eq.${ticketId}`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function listTicketRatings(): Promise<TicketRating[]> {
  return listTable<TicketRating>("ticket_ratings", { order: "created_at.desc", limit: 500 });
}

/* ------------------------------------------------------------------ writes */

export async function logActivity(input: {
  ticketId: string;
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  from?: string | null;
  to?: string | null;
  note?: string | null;
}) {
  await createRecord("ticket_activity", {
    ticket_id: input.ticketId,
    action: input.action,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    actor_name: input.actorName ?? null,
    from_value: input.from ?? null,
    to_value: input.to ?? null,
    note: input.note ?? null,
  });
}

export async function addAttachments(input: {
  ticketId: string;
  messageId?: string | null;
  urls: string[];
  uploadedBy?: string | null;
  uploaderRole?: string | null;
  kind?: "image" | "document";
}) {
  for (const url of input.urls.filter(Boolean)) {
    await createRecord("ticket_attachments", {
      ticket_id: input.ticketId,
      message_id: input.messageId ?? null,
      uploaded_by: input.uploadedBy ?? null,
      uploader_role: input.uploaderRole ?? null,
      url,
      file_name: url.split("/").pop() ?? null,
      kind: input.kind ?? "image",
    });
  }
}

export async function createTicket(input: {
  title: string;
  description: string;
  role: TicketRole;
  createdBy: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  attachments?: string[];
  documents?: string[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  referenceId?: string;
  restaurantId?: string | null;
  driverId?: string | null;
  orderId?: string | null;
}): Promise<SupportTicket | null> {
  const now = new Date().toISOString();
  const category = input.category ?? "other";
  const priority = input.priority ?? suggestPriority(category);
  const files = [...(input.attachments ?? []), ...(input.documents ?? [])].filter(Boolean);
  const payload = {
    ticket_code: newTicketCode(),
    title: input.title,
    description: input.description,
    category,
    role: input.role,
    created_by: input.createdBy || null,
    priority,
    status: "open",
    attachments: files,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null,
    reference_id: input.referenceId ?? null,
    restaurant_id: input.restaurantId ?? null,
    driver_id: input.driverId ?? null,
    order_id: input.orderId ?? null,
    sla_due_at: new Date(Date.now() + SLA_HOURS[priority] * 3_600_000).toISOString(),
    last_message_at: now,
    unread_for_agent: 1,
    unread_for_owner: 0,
    updated_at: now,
  };
  const created = await createRecord<SupportTicket[] | SupportTicket>("support_tickets", payload);
  const row = (Array.isArray(created) ? created[0] : created) as SupportTicket | null;
  if (row?.id) {
    await logActivity({
      ticketId: row.id,
      action: "created",
      actorId: input.createdBy,
      actorRole: input.role,
      actorName: input.contactName ?? null,
      to: "open",
      note: CATEGORY_LABEL[category],
    });
    if (files.length) {
      await addAttachments({
        ticketId: row.id,
        urls: files,
        uploadedBy: input.createdBy,
        uploaderRole: input.role,
      });
    }
  }
  return row ?? null;
}

export async function updateTicket(id: string, patch: Partial<SupportTicket>) {
  await patchRecord("support_tickets", id, {
    ...patch,
    updated_at: new Date().toISOString(),
  } as Record<string, unknown>);
}

const AGENT_ROLES = new Set(["admin", "agent", "manager", "support"]);

export async function addTicketMessage(input: {
  ticketId: string;
  authorId: string;
  authorRole: string;
  authorName?: string | null;
  message: string;
  attachments?: string[];
  internal?: boolean;
  /** Ticket row, when known — lets us maintain SLA + unread counters. */
  ticket?: SupportTicket | null;
}) {
  const now = new Date().toISOString();
  const created = await createRecord<TicketMessage[] | TicketMessage>("support_ticket_messages", {
    ticket_id: input.ticketId,
    author_id: input.authorId || null,
    author_role: input.authorRole,
    author_name: input.authorName ?? null,
    message: input.message,
    internal: !!input.internal,
    attachments: input.attachments?.length ? input.attachments : [],
  });
  const msg = (Array.isArray(created) ? created[0] : created) as TicketMessage | null;

  if (input.attachments?.length) {
    await addAttachments({
      ticketId: input.ticketId,
      messageId: msg?.id ?? null,
      urls: input.attachments,
      uploadedBy: input.authorId,
      uploaderRole: input.authorRole,
    });
  }

  if (input.internal) {
    await logActivity({
      ticketId: input.ticketId,
      action: "internal_note",
      actorId: input.authorId,
      actorRole: input.authorRole,
      actorName: input.authorName ?? null,
    });
    return;
  }

  const t = input.ticket;
  const fromAgent = AGENT_ROLES.has(input.authorRole);
  const patch: Partial<SupportTicket> = { last_message_at: now };
  if (fromAgent) {
    patch.unread_for_owner = (t?.unread_for_owner ?? 0) + 1;
    patch.unread_for_agent = 0;
    if (t && !t.first_response_at) {
      patch.first_response_at = now;
      const sla = ticketSla(t);
      if (sla.overdue) patch.sla_breached = true;
    }
    if (t && ticketStatus(t) === "open") patch.status = "assigned";
  } else {
    patch.unread_for_agent = (t?.unread_for_agent ?? 0) + 1;
    patch.unread_for_owner = 0;
  }
  await updateTicket(input.ticketId, patch);

  await logActivity({
    ticketId: input.ticketId,
    action: "replied",
    actorId: input.authorId,
    actorRole: input.authorRole,
    actorName: input.authorName ?? null,
  });

  // Notify the other side.
  if (fromAgent && t?.created_by) {
    await notify(t.created_by, "Support replied", `${t.ticket_code ?? "Your ticket"}: ${input.message.slice(0, 120)}`);
  } else if (!fromAgent && t?.assigned_agent_id) {
    await notify(t.assigned_agent_id, "New ticket reply", `${t.ticket_code ?? "Ticket"}: ${input.message.slice(0, 120)}`);
  }
}

export async function setTicketStatus(
  ticket: SupportTicket,
  status: TicketStatus,
  actor: { id?: string | null; role?: string | null; name?: string | null } = {},
) {
  const now = new Date().toISOString();
  const patch: Partial<SupportTicket> = { status };
  if (status === "resolved") patch.resolved_at = now;
  if (status === "closed") patch.closed_at = now;
  if (status === "reopened") {
    patch.reopen_count = (ticket.reopen_count ?? 0) + 1;
    patch.resolved_at = null;
    patch.closed_at = null;
  }
  await updateTicket(ticket.id, patch);
  await logActivity({
    ticketId: ticket.id,
    action: "status_changed",
    actorId: actor.id ?? null,
    actorRole: actor.role ?? null,
    actorName: actor.name ?? null,
    from: ticketStatus(ticket),
    to: status,
  });
  if (ticket.created_by && actor.role && AGENT_ROLES.has(actor.role)) {
    await notify(
      ticket.created_by,
      `Ticket ${STATUS_LABEL[status] ?? status}`,
      `${ticket.ticket_code ?? "Your ticket"} is now ${STATUS_LABEL[status] ?? status}.`,
    );
  }
}

export async function assignTicket(
  ticket: SupportTicket,
  agent: { id: string; name?: string | null; role?: string | null },
  by: { id?: string | null; role?: string | null; name?: string | null } = {},
  opts: { transfer?: boolean; reason?: string } = {},
) {
  await updateTicket(ticket.id, {
    assigned_agent_id: agent.id,
    assigned_agent_name: agent.name ?? null,
    assigned_admin: agent.name ?? agent.id,
    status: ticketStatus(ticket) === "open" ? "assigned" : ticketStatus(ticket),
  });
  await createRecord("ticket_assignments", {
    ticket_id: ticket.id,
    agent_id: agent.id,
    agent_name: agent.name ?? null,
    agent_role: agent.role ?? "admin",
    assigned_by: by.id ?? null,
    reason: opts.reason ?? null,
    active: true,
  });
  await logActivity({
    ticketId: ticket.id,
    action: opts.transfer ? "transferred" : "assigned",
    actorId: by.id ?? null,
    actorRole: by.role ?? "admin",
    actorName: by.name ?? null,
    from: ticket.assigned_agent_name ?? null,
    to: agent.name ?? agent.id,
    note: opts.reason ?? null,
  });
  await notify(agent.id, "Ticket assigned to you", `${ticket.ticket_code ?? "A ticket"} — ${ticket.title ?? ""}`);
}

export async function escalateTicket(
  ticket: SupportTicket,
  by: { id?: string | null; role?: string | null; name?: string | null } = {},
  reason?: string,
) {
  await updateTicket(ticket.id, {
    escalated: true,
    escalated_at: new Date().toISOString(),
    priority: ticketPriority(ticket) === "urgent" ? "urgent" : "high",
  });
  await logActivity({
    ticketId: ticket.id,
    action: "escalated",
    actorId: by.id ?? null,
    actorRole: by.role ?? null,
    actorName: by.name ?? null,
    note: reason ?? null,
  });
}

/** Merge `source` into `target`: the source closes and points at the target. */
export async function mergeTickets(
  source: SupportTicket,
  targetId: string,
  by: { id?: string | null; role?: string | null; name?: string | null } = {},
) {
  const now = new Date().toISOString();
  await updateTicket(source.id, {
    merged_into: targetId,
    status: "closed",
    closed_at: now,
  });
  await logActivity({
    ticketId: source.id,
    action: "merged",
    actorId: by.id ?? null,
    actorRole: by.role ?? "admin",
    actorName: by.name ?? null,
    to: targetId,
  });
  await logActivity({
    ticketId: targetId,
    action: "merge_received",
    actorId: by.id ?? null,
    actorRole: by.role ?? "admin",
    actorName: by.name ?? null,
    from: source.id,
    note: source.ticket_code ?? null,
  });
}

export async function rateTicket(input: {
  ticketId: string;
  userId: string;
  rating: number;
  comment?: string;
  agentId?: string | null;
}) {
  await createRecord("ticket_ratings", {
    ticket_id: input.ticketId,
    user_id: input.userId || null,
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    comment: input.comment ?? null,
    agent_id: input.agentId ?? null,
  });
  await logActivity({
    ticketId: input.ticketId,
    action: "rated",
    actorId: input.userId,
    actorRole: "customer",
    to: String(input.rating),
  });
}

/** Clear the unread badge for whoever just opened the thread. */
export async function markTicketRead(ticket: SupportTicket, viewer: "owner" | "agent") {
  const field = viewer === "owner" ? "unread_for_owner" : "unread_for_agent";
  if (!(ticket as Record<string, unknown>)[field]) return;
  await updateTicket(ticket.id, { [field]: 0 } as Partial<SupportTicket>);
}

/* ------------------------------------------------------------------ search */

/** Free-text search across ticket ID, people, contact details and order ID. */
export function matchesTicket(t: SupportTicket, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [
    t.ticket_code,
    t.id,
    t.title,
    t.description,
    t.contact_name,
    t.contact_phone,
    t.contact_email,
    t.order_id,
    t.reference_id,
    t.restaurant_id,
    t.driver_id,
    t.assigned_agent_name,
    t.assigned_admin,
    t.role,
    t.category && CATEGORY_LABEL[t.category],
  ].some((v) => (v ?? "").toString().toLowerCase().includes(q));
}

/* --------------------------------------------------------------- analytics */

export type SupportAnalytics = {
  total: number;
  open: number;
  closed: number;
  resolved: number;
  overdue: number;
  breached: number;
  escalated: number;
  avgFirstResponseMins: number | null;
  avgResolutionMins: number | null;
  byCategory: { key: string; label: string; count: number }[];
  byStatus: Record<string, number>;
  byRole: Record<string, number>;
  agents: { agent: string; assigned: number; resolved: number; avgResolutionMins: number | null; avgRating: number | null }[];
  daily: { day: string; created: number; closed: number }[];
  avgRating: number | null;
};

export function computeSupportAnalytics(
  tickets: SupportTicket[],
  ratings: TicketRating[] = [],
): SupportAnalytics {
  const byStatus: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const byCategoryMap: Record<string, number> = {};
  const firstResponses: number[] = [];
  const resolutions: number[] = [];
  const agentMap = new Map<string, { assigned: number; resolved: number; res: number[]; ratings: number[] }>();
  const dayMap = new Map<string, { created: number; closed: number }>();

  let open = 0, closed = 0, resolved = 0, overdue = 0, breached = 0, escalated = 0;

  const ratingByAgent = new Map<string, number[]>();
  const ratingByTicket = new Map<string, number>();
  ratings.forEach((r) => {
    if (r.ticket_id && typeof r.rating === "number") ratingByTicket.set(r.ticket_id, r.rating);
    if (r.agent_id && typeof r.rating === "number") {
      const arr = ratingByAgent.get(r.agent_id) ?? [];
      arr.push(r.rating);
      ratingByAgent.set(r.agent_id, arr);
    }
  });

  for (const t of tickets) {
    const s = ticketStatus(t);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    const role = String(t.role ?? "customer");
    byRole[role] = (byRole[role] ?? 0) + 1;
    const cat = ticketCategory(t);
    byCategoryMap[cat] = (byCategoryMap[cat] ?? 0) + 1;
    if (isTicketOpen(t)) open += 1;
    if (s === "closed") closed += 1;
    if (s === "resolved") resolved += 1;
    if (t.escalated) escalated += 1;

    const sla = ticketSla(t);
    if (sla.overdue) overdue += 1;
    if (sla.breached) breached += 1;
    if (sla.firstResponseMins !== null) firstResponses.push(sla.firstResponseMins);
    if (sla.resolutionMins !== null) resolutions.push(sla.resolutionMins);

    const agent = t.assigned_agent_name ?? t.assigned_admin ?? null;
    if (agent) {
      const cur = agentMap.get(agent) ?? { assigned: 0, resolved: 0, res: [], ratings: [] };
      cur.assigned += 1;
      if (s === "resolved" || s === "closed") cur.resolved += 1;
      if (sla.resolutionMins !== null) cur.res.push(sla.resolutionMins);
      const r = ratingByTicket.get(t.id);
      if (typeof r === "number") cur.ratings.push(r);
      agentMap.set(agent, cur);
    }

    const day = (t.created_at ?? "").slice(0, 10);
    if (day) {
      const d = dayMap.get(day) ?? { created: 0, closed: 0 };
      d.created += 1;
      dayMap.set(day, d);
    }
    const cday = (t.closed_at ?? "").slice(0, 10);
    if (cday) {
      const d = dayMap.get(cday) ?? { created: 0, closed: 0 };
      d.closed += 1;
      dayMap.set(cday, d);
    }
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const allRatings = ratings.map((r) => r.rating).filter((r): r is number => typeof r === "number");

  return {
    total: tickets.length,
    open,
    closed,
    resolved,
    overdue,
    breached,
    escalated,
    avgFirstResponseMins: avg(firstResponses),
    avgResolutionMins: avg(resolutions),
    byCategory: Object.entries(byCategoryMap)
      .map(([key, count]) => ({ key, label: CATEGORY_LABEL[key] ?? key, count }))
      .sort((a, b) => b.count - a.count),
    byStatus,
    byRole,
    agents: [...agentMap.entries()]
      .map(([agent, v]) => ({
        agent,
        assigned: v.assigned,
        resolved: v.resolved,
        avgResolutionMins: avg(v.res),
        avgRating: v.ratings.length ? Number((v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length).toFixed(2)) : null,
      }))
      .sort((a, b) => b.assigned - a.assigned),
    daily: [...dayMap.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14),
    avgRating: allRatings.length
      ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
      : null,
  };
}

export function formatMins(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
