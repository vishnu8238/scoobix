/**
 * Support ticket system (InsForge backed).
 *
 * Tables:
 *  - `support_tickets`        one row per ticket (shared by customer / restaurant / driver)
 *  - `support_ticket_messages` conversation thread on a ticket
 *
 * All calls are best-effort (the CRUD layer never throws).
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketRole = "customer" | "restaurant" | "driver";

export type SupportTicket = {
  id: string;
  ticket_code?: string | null;
  title?: string | null;
  description?: string | null;
  attachments?: string[] | string | null;
  priority?: TicketPriority | string | null;
  created_by?: string | null;
  role?: string | null;
  status?: TicketStatus | string | null;
  assigned_admin?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  reference_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TicketMessage = {
  id: string;
  ticket_id?: string | null;
  author_id?: string | null;
  author_role?: string | null;
  message?: string | null;
  attachments?: string[] | string | null;
  created_at?: string | null;
};

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting", "resolved", "closed"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_TONE: Record<TicketStatus, string> = {
  open: "bg-sky-100 text-sky-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting: "bg-violet-100 text-violet-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-zinc-200 text-zinc-700",
};

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

export function ticketStatus(t: SupportTicket): TicketStatus {
  const s = (t.status ?? "open") as TicketStatus;
  return TICKET_STATUSES.includes(s) ? s : "open";
}

export function ticketAttachments(t: SupportTicket | TicketMessage): string[] {
  const a = t.attachments;
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean);
  try {
    const parsed = JSON.parse(a as string);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function newTicketCode() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TKT-${stamp}-${rand}`;
}

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

export async function createTicket(input: {
  title: string;
  description: string;
  role: TicketRole;
  createdBy: string;
  priority?: TicketPriority;
  attachments?: string[];
  contactName?: string;
  contactPhone?: string;
  referenceId?: string;
}): Promise<SupportTicket | null> {
  const now = new Date().toISOString();
  const payload = {
    ticket_code: newTicketCode(),
    title: input.title,
    description: input.description,
    role: input.role,
    created_by: input.createdBy || null,
    priority: input.priority ?? "normal",
    status: "open",
    attachments: input.attachments?.length ? input.attachments : [],
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    reference_id: input.referenceId ?? null,
    updated_at: now,
  };
  const created = await createRecord<SupportTicket[] | SupportTicket>("support_tickets", payload);
  const row = Array.isArray(created) ? created[0] : created;
  return (row as SupportTicket) ?? null;
}

export async function updateTicket(id: string, patch: Partial<SupportTicket>) {
  await patchRecord("support_tickets", id, { ...patch, updated_at: new Date().toISOString() } as Record<string, unknown>);
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  if (!ticketId) return [];
  return listTable<TicketMessage>("support_ticket_messages", {
    ticket_id: `eq.${ticketId}`,
    order: "created_at.asc",
    limit: 300,
  });
}

export async function addTicketMessage(input: {
  ticketId: string;
  authorId: string;
  authorRole: string;
  message: string;
  attachments?: string[];
}) {
  await createRecord("support_ticket_messages", {
    ticket_id: input.ticketId,
    author_id: input.authorId || null,
    author_role: input.authorRole,
    message: input.message,
    attachments: input.attachments?.length ? input.attachments : [],
  });
  await updateTicket(input.ticketId, {});
}
