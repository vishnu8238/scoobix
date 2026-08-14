import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

export type TicketRole = "customer" | "restaurant" | "driver" | "manager" | "admin";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed" | "escalated" | "reopened";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "orders" | "account" | "payment" | "technical" | "other";

export type SupportTicket = {
  id: string;
  ticket_code: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  role: TicketRole;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  created_by?: string;
  order_id?: string;
  restaurant_id?: string;
  reference_id?: string;
  attachments?: string[];
  documents?: string[];
  unread_for_owner?: number;
  unread_for_agent?: number;
  escalated?: boolean;
  merged_into?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  first_responded_at?: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  message: string;
  attachments?: string[];
  is_internal?: boolean;
  internal?: boolean; // Alias for is_internal
  created_at: string;
};

export type TicketActivity = {
  id: string;
  ticket_id: string;
  actor_id: string;
  actor_name: string;
  actor_role?: string;
  action: string;
  to_value?: string;
  created_at: string;
};

export type TicketAssignment = {
  id: string;
  ticket_id: string;
  agent_id: string;
  agent_name: string;
  assigned_at: string;
  created_at?: string; // Alias for assigned_at
};

export type TicketRating = {
  id: string;
  ticket_id: string;
  user_id: string;
  agent_id?: string;
  rating: number;
  comment?: string;
  created_at: string;
};

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed", "escalated", "reopened"];
export const TICKET_PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
export const TICKET_CATEGORIES: TicketCategory[] = ["orders", "account", "payment", "technical", "other"];

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
  reopened: "Reopened",
};

export const STATUS_TONE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-zinc-100 text-zinc-700",
  escalated: "bg-rose-100 text-rose-700",
  reopened: "bg-blue-50 text-blue-600",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

export const CATEGORY_LABEL: Record<string, string> = {
  orders: "Orders & Delivery",
  account: "Account & Profile",
  payment: "Payments & Refunds",
  technical: "Technical Issue",
  other: "General Inquiry",
};

export async function listAllTickets() {
  return listTable<SupportTicket>("support_tickets", { order: "created_at.desc" });
}

export async function listMyTickets(userId: string) {
  return listTable<SupportTicket>("support_tickets", { created_by: `eq.${userId}`, order: "created_at.desc" });
}

export async function listTicketMessages(ticketId: string, opts?: { includeInternal?: boolean }) {
  const params: any = { ticket_id: `eq.${ticketId}`, order: "created_at.asc" };
  if (!opts?.includeInternal) params.is_internal = "eq.false";
  return listTable<TicketMessage>("support_ticket_messages", params);
}

export async function listTicketActivity(ticketId: string) {
  return listTable<TicketActivity>("ticket_activity", { ticket_id: `eq.${ticketId}`, order: "created_at.desc" });
}

export async function listTicketAssignments(ticketId: string) {
  return listTable<TicketAssignment>("ticket_assignments", { ticket_id: `eq.${ticketId}`, order: "assigned_at.desc" });
}

export async function listTicketRatings() {
  return listTable<TicketRating>("ticket_ratings", { limit: 1000 });
}

export async function getTicketRating(ticketId: string) {
  const [r] = await listTable<TicketRating>("ticket_ratings", { ticket_id: `eq.${ticketId}`, limit: 1 });
  return r || null;
}

export async function createTicket(data: Partial<SupportTicket>) {
  const ticket_code = `TKT-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  return createRecord<SupportTicket>("support_tickets", { ...data, ticket_code, status: "open" });
}

export async function addTicketMessage(data: any, legacyTicketArg?: any) {
  // Handle legacy 3-arg calls
  const ticketId = typeof data === 'string' ? data : data.ticketId;
  const payload = typeof data === 'string' ? legacyTicketArg : data;
  
  const msg = await createRecord<TicketMessage>("support_ticket_messages", {
    ticket_id: ticketId,
    author_id: payload.authorId || payload.author_id,
    author_name: payload.authorName || payload.author_name,
    author_role: payload.authorRole || payload.author_role,
    message: payload.message || payload.content,
    attachments: payload.attachments,
    is_internal: payload.is_internal ?? payload.internal ?? false,
    internal: payload.is_internal ?? payload.internal ?? false,
  });
  
  if (msg && !(payload.is_internal || payload.internal) && (payload.authorRole === "admin" || payload.author_role === "admin")) {
    await patchRecord("support_tickets", ticketId, { 
      unread_for_owner: 1,
      first_responded_at: new Date().toISOString()
    });
  }
  return msg;
}

export async function setTicketStatus(ticket: SupportTicket | string, status: TicketStatus, actor: any) {
  const id = typeof ticket === 'string' ? ticket : ticket.id;
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === "closed" || status === "resolved") patch.closed_at = new Date().toISOString();
  await patchRecord("support_tickets", id, patch);
  await createRecord("ticket_activity", {
    ticket_id: id,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: `Changed status to ${status}`,
    to_value: status
  });
}

export async function assignTicket(ticket: SupportTicket | string, agent: any, actor: any, opts?: any) {
  const id = typeof ticket === 'string' ? ticket : ticket.id;
  await patchRecord("support_tickets", id, { 
    assigned_agent_id: agent.id, 
    assigned_agent_name: agent.name 
  });
  await createRecord("ticket_assignments", {
    ticket_id: id,
    agent_id: agent.id,
    agent_name: agent.name,
    assigned_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });
  await createRecord("ticket_activity", {
    ticket_id: id,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: `Assigned to ${agent.name}`,
    to_value: agent.id
  });
}

export async function rateTicket(data: any) {
  return createRecord<TicketRating>("ticket_ratings", data);
}

export async function markTicketRead(ticket: SupportTicket, role: "owner" | "agent") {
  const field = role === "owner" ? "unread_for_owner" : "unread_for_agent";
  return patchRecord("support_tickets", ticket.id, { [field]: 0 });
}

export async function mergeTickets(sourceId: string, targetId: string, actor: any) {
  await patchRecord("support_tickets", sourceId, { status: "closed", merged_into: targetId });
  await createRecord("ticket_activity", {
    ticket_id: sourceId,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: `Merged into ${targetId}`,
    to_value: targetId
  });
}

export function ticketStatus(t: SupportTicket) { return t.status; }
export function ticketPriority(t: SupportTicket) { return t.priority; }
export function ticketCategory(t: SupportTicket) { return t.category; }

export function ticketSla(t: SupportTicket) {
  const created = new Date(t.created_at).getTime();
  const now = Date.now();
  const firstResp = t.first_responded_at ? new Date(t.first_responded_at).getTime() : null;
  const closed = t.closed_at ? new Date(t.closed_at).getTime() : null;
  
  const firstResponseMins = firstResp ? Math.round((firstResp - created) / 60000) : Math.round((now - created) / 60000);
  const resolutionMins = closed ? Math.round((closed - created) / 60000) : null;
  
  return {
    firstResponseMins,
    resolutionMins,
    overdue: !firstResp && firstResponseMins > 60,
    breached: t.priority === "urgent" && firstResponseMins > 30,
    escalateDue: t.priority === "urgent" && !t.escalated
  };
}

export function formatMins(m: number | null) {
  if (m === null) return "—";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function suggestPriority(cat: TicketCategory): TicketPriority {
  if (cat === "technical") return "high";
  if (cat === "payment") return "medium";
  return "low";
}

export function matchesTicket(t: SupportTicket, q: string) {
  const search = q.toLowerCase();
  return (
    t.ticket_code.toLowerCase().includes(search) ||
    t.title.toLowerCase().includes(search) ||
    t.description.toLowerCase().includes(search) ||
    (t.contact_name || "").toLowerCase().includes(search) ||
    (t.order_id || "").toLowerCase().includes(search)
  );
}

export function ticketAttachments(t: any) {
  return t.attachments || [];
}

export function computeSupportAnalytics(tickets: SupportTicket[], ratings: TicketRating[]) {
  const open = tickets.filter(t => ["open", "in_progress", "escalated", "reopened"].includes(t.status)).length;
  const closed = tickets.filter(t => ["resolved", "closed"].includes(t.status)).length;
  const overdue = tickets.filter(t => ticketSla(t).overdue).length;
  const breached = tickets.filter(t => ticketSla(t).breached).length;
  const avgRating = ratings.length ? Number((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)) : null;

  const byCategory = TICKET_CATEGORIES.map(cat => ({
    key: cat,
    label: CATEGORY_LABEL[cat],
    count: tickets.filter(t => t.category === cat).length
  })).sort((a, b) => b.count - a.count);

  const daily: any[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    daily.push({
      day,
      created: tickets.filter(t => t.created_at.startsWith(day)).length,
      closed: tickets.filter(t => t.closed_at?.startsWith(day)).length
    });
  }

  const agentStats: Record<string, any> = {};
  tickets.forEach(t => {
    if (!t.assigned_agent_id) return;
    const name = t.assigned_agent_name || t.assigned_agent_id;
    if (!agentStats[name]) agentStats[name] = { agent: name, assigned: 0, resolved: 0, ratings: [], totalResMins: 0 };
    agentStats[name].assigned++;
    if (t.status === "closed" || t.status === "resolved") {
      agentStats[name].resolved++;
      const sla = ticketSla(t);
      if (sla.resolutionMins) agentStats[name].totalResMins += sla.resolutionMins;
    }
  });

  ratings.forEach(r => {
    if (!r.agent_id) return;
    const agent = tickets.find(t => t.assigned_agent_id === r.agent_id)?.assigned_agent_name || r.agent_id;
    if (agentStats[agent]) agentStats[agent].ratings.push(r.rating);
  });

  const agents = Object.values(agentStats).map(a => ({
    agent: a.agent,
    assigned: a.assigned,
    resolved: a.resolved,
    avgResolutionMins: a.resolved ? Math.round(a.totalResMins / a.resolved) : null,
    avgRating: a.ratings.length ? Number((a.ratings.reduce((s: number, r: number) => s + r, 0) / a.ratings.length).toFixed(1)) : null
  })).sort((a, b) => b.assigned - a.assigned);

  return {
    total: tickets.length,
    open,
    closed,
    overdue,
    breached,
    avgRating,
    byCategory,
    daily,
    agents,
    avgFirstResponseMins: tickets.length ? Math.round(tickets.reduce((s, t) => s + ticketSla(t).firstResponseMins, 0) / tickets.length) : 0,
    avgResolutionMins: closed ? Math.round(tickets.filter(t => t.closed_at).reduce((s, t) => s + (ticketSla(t).resolutionMins || 0), 0) / closed) : 0,
    escalated: tickets.filter(t => t.status === "escalated" || t.escalated).length
  };
}

export async function escalateTicket(ticket: SupportTicket | string, actor: any) {
  const id = typeof ticket === 'string' ? ticket : ticket.id;
  await patchRecord("support_tickets", id, { status: "escalated", escalated: true });
  await createRecord("ticket_activity", {
    ticket_id: id,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: "Escalated ticket",
  });
}

// Missing legacy exports aliases
export const TICKET_CATEGORIES_LIST = TICKET_CATEGORIES;
export const TICKET_STATUSES_LIST = TICKET_STATUSES;
