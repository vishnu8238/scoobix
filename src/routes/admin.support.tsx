import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/cravio/AdminTable";
import { useAuth } from "@/lib/auth-store";
import {
  addTicketMessage,
  listAllTickets,
  listTicketMessages,
  ticketAttachments,
  ticketStatus,
  updateTicket,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus,
} from "@/lib/support-api";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Support" }] }),
  component: AdminSupport,
});

const ROLE_FILTERS = ["all", "customer", "restaurant", "driver"] as const;

function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await listAllTickets();
    setTickets(rows);
    setSelected((cur) => (cur ? rows.find((r) => r.id === cur.id) ?? null : null));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (roleFilter !== "all" && (t.role ?? "") !== roleFilter) return false;
      if (statusFilter !== "all" && ticketStatus(t) !== statusFilter) return false;
      if (!term) return true;
      return [t.ticket_code, t.title, t.description, t.contact_name, t.contact_phone]
        .some((v) => (v ?? "").toString().toLowerCase().includes(term));
    });
  }, [tickets, q, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    TICKET_STATUSES.forEach((s) => (base[s] = 0));
    tickets.forEach((t) => (base[ticketStatus(t)] += 1));
    return base;
  }, [tickets]);

  const setStatus = async (t: SupportTicket, status: TicketStatus) => {
    await updateTicket(t.id, { status, assigned_admin: user?.email ?? t.assigned_admin ?? null });
    toast.success(`Ticket ${t.ticket_code} → ${STATUS_LABEL[status]}`);
    void refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Support</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Support dashboard</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-5">
        {TICKET_STATUSES.map((s) => (
          <div key={s} className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{STATUS_LABEL[s]}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{counts[s] ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket ID, title, contact" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${roleFilter === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{r}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...TICKET_STATUSES] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s === "all" ? "all" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <DataTable
            columns={["Ticket ID", "Title", "Role", "Priority", "Contact", "Created", "Status", "Actions"]}
            rows={filtered.map((t) => {
              const s = ticketStatus(t);
              return [
                <button key={t.id + "c"} onClick={() => setSelected(t)} className="font-mono text-xs font-bold text-primary">{t.ticket_code}</button>,
                <span key={t.id + "t"} className="font-bold">{t.title}</span>,
                <span key={t.id + "r"} className="text-muted-foreground">{t.role}</span>,
                <span key={t.id + "p"} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_TONE[t.priority ?? "normal"] ?? PRIORITY_TONE.normal}`}>{t.priority ?? "normal"}</span>,
                <span key={t.id + "ct"} className="text-muted-foreground">{t.contact_name ?? "—"}{t.contact_phone ? ` · ${t.contact_phone}` : ""}</span>,
                <span key={t.id + "d"} className="text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</span>,
                <span key={t.id + "s"} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>,
                <select
                  key={t.id + "a"}
                  value={s}
                  onChange={(e) => void setStatus(t, e.target.value as TicketStatus)}
                  className="rounded-xl bg-muted/60 px-2 py-1.5 text-xs font-bold outline-none ring-1 ring-border/60"
                >
                  {TICKET_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
                </select>,
              ];
            })}
          />
        )}
      </section>

      {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TicketDetail({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void listTicketMessages(ticket.id).then(setMessages); }, [ticket.id]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    await addTicketMessage({ ticketId: ticket.id, authorId: user?.id ?? "", authorRole: "admin", message: reply.trim() });
    setReply("");
    setMessages(await listTicketMessages(ticket.id));
    setBusy(false);
  };

  const files = ticketAttachments(ticket);

  return (
    <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">{ticket.ticket_code}</p>
          <h2 className="mt-1 font-display text-xl font-extrabold">{ticket.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ticket.description}</p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">Close</button>
      </div>

      {files.length > 0 && (
        <div className="flex gap-2">{files.map((f) => <img key={f} src={f} alt="Ticket attachment" className="h-20 w-20 rounded-xl object-cover" />)}</div>
      )}

      <div className="space-y-2">
        {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.author_role === "admin" ? "bg-primary-soft" : "bg-muted/60"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.author_role}</p>
            <p className="mt-0.5">{m.message}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the reporter" className="flex-1 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
        <button onClick={send} disabled={busy} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
    </section>
  );
}
