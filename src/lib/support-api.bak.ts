import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

export type SupportTicket = {
  id: string;
  ticket_code: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "escalated";
  priority: "low" | "medium" | "high" | "urgent";
  contact_name?: string;
  contact_email?: string;
  role?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_internal: boolean;
  created_at: string;
};

export async function fetchTickets(params?: Record<string, any>) {
  return listTable<SupportTicket>("support_tickets", { order: "created_at.desc", ...params });
}

export async function fetchTicketDetails(id: string) {
  const [ticket] = await listTable<SupportTicket>("support_tickets", { id: `eq.${id}`, limit: 1 });
  return ticket || null;
}

export async function fetchTicketComments(ticketId: string) {
  return listTable<TicketComment>("support_comments", { 
    ticket_id: `eq.${ticketId}`, 
    order: "created_at.asc" 
  });
}

export async function addTicketComment(comment: Omit<TicketComment, "id" | "created_at">) {
  return createRecord<TicketComment>("support_comments", comment as any);
}

export async function updateTicketStatus(id: string, status: SupportTicket["status"], actor: { id: string, name: string }) {
  const now = new Date().toISOString();
  await patchRecord("support_tickets", id, { status, updated_at: now });
  
  // Log status change as an internal comment
  await addTicketComment({
    ticket_id: id,
    author_id: actor.id,
    author_name: actor.name,
    author_role: "logistics",
    content: `Status changed to ${status.toUpperCase().replace('_', ' ')}`,
    is_internal: true
  });
}
