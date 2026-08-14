import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Loader2, Merge, Search, Send, Star, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/cravio/AdminTable";
import { useAuth } from "@/lib/auth-store";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion, useChannelVersion } from "@/lib/realtime-hooks";
import {
  addTicketMessage,
  assignTicket,
  computeSupportAnalytics,
  escalateTicket,
  formatMins,
  listAllTickets,
  listTicketActivity,
  listTicketAssignments,
  listTicketMessages,
  listTicketRatings,
  markTicketRead,
  matchesTicket,
  mergeTickets,
  setTicketStatus,
  ticketAttachments,
  ticketCategory,
  ticketPriority,
  ticketSla,
  ticketStatus,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketActivity,
  type TicketAssignment,
  type TicketMessage,
  type TicketRating,
  type TicketStatus,
} from "@/lib/support-api";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Support Center" },
      { name: "description", content: "Unified omnichannel support desk: assign, escalate, merge and resolve tickets across every Scoobix app." },
      { property: "og:title", content: "Scoobix Admin · Support Center" },
      { property: "og:description", content: "Unified omnichannel support desk for the Scoobix platform." },
    ],
  }),
  component: AdminSupport,
});

const ROLE_FILTERS = ["all", "customer", "restaurant", "driver", "manager"] as const;

type Agent = { id: string; name: string };

function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ratings, setRatings] = useState<TicketRating[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | string>("all");
  const [agentFilter, setAgentFilter] = useState<"all" | "unassigned" | string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const version = useTableVersion(["support_tickets", "support_ticket_messages", "ticket_ratings"]);

  const refresh = useCallback(async () => {
    const [rows, rats] = await Promise.all([listAllTickets(), listTicketRatings()]);
    setTickets(rows);
    setRatings(rats);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, version]);

  useEffect(() => {
    void (async () => {
      const rows = await listTable<{ id: string; user_id?: string; email?: string; status?: string }>(
        "platform_admins",
        { limit: 100 },
      );
      setAgents(
        rows
          .filter((r) => (r.status ?? "active") !== "disabled" && (r.user_id || r.email))
          .map((r) => ({ id: r.user_id ?? r.email ?? r.id, name: r.email ?? r.user_id ?? r.id })),
      );
    })();
  }, []);

  const filtered = useMemo(() => {
    const fromTs = from ? Date.parse(from) : null;
    const toTs = to ? Date.parse(to) + 86_400_000 : null;
    return tickets.filter((t) => {
      if (roleFilter !== "all" && (t.role ?? "") !== roleFilter) return false;
      if (statusFilter !== "all" && ticketStatus(t) !== statusFilter) return false;
      if (categoryFilter !== "all" && ticketCategory(t) !== categoryFilter) return false;
      if (priorityFilter !== "all" && ticketPriority(t) !== priorityFilter) return false;
      if (agentFilter === "unassigned" && t.assigned_agent_id) return false;
      if (agentFilter !== "all" && agentFilter !== "unassigned" && t.assigned_agent_id !== agentFilter) return false;
      const ts = t.created_at ? Date.parse(t.created_at) : null;
      if (fromTs && (!ts || ts < fromTs)) return false;
      if (toTs && (!ts || ts > toTs)) return false;
      return matchesTicket(t, q);
    });
  }, [tickets, q, roleFilter, statusFilter, categoryFilter, priorityFilter, agentFilter, from, to]);

  const stats = useMemo(() => computeSupportAnalytics(tickets, ratings), [tickets, ratings]);
  const selected = useMemo(() => tickets.find((t) => t.id === selectedId) ?? null, [tickets, selectedId]);

  const actor = { id: user?.id ?? null, role: "admin", name: user?.email ?? user?.name ?? "Support" };

  const changeStatus = async (t: SupportTicket, status: TicketStatus) => {
    await setTicketStatus(t, status, actor);
    toast.success(`${t.ticket_code} → ${STATUS_LABEL[status]}`);
    void refresh();
  };

  const doAssign = async (t: SupportTicket, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? { id: agentId, name: agentId };
    await assignTicket(t, { id: agent.id, name: agent.name, role: "admin" }, actor, {
      transfer: !!t.assigned_agent_id,
    });
    toast.success(`${t.ticket_code} assigned to ${agent.name}`);
    void refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Support</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Support Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every ticket from customers, restaurants, riders and merchant managers — live.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total tickets" value={stats.total} />
        <Kpi label="Open" value={stats.open} />
        <Kpi label="Closed" value={stats.closed} />
        <Kpi label="Avg first response" value={formatMins(stats.avgFirstResponseMins)} />
        <Kpi label="Avg resolution" value={formatMins(stats.avgResolutionMins)} />
        <Kpi label="Overdue / breached" value={`${stats.overdue} / ${stats.breached}`} tone={stats.overdue ? "text-rose-600" : undefined} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Category distribution</p>
          {stats.byCategory.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet.</p>}
          {stats.byCategory.slice(0, 7).map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs font-semibold">{c.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((c.count / Math.max(1, stats.total)) * 100)}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-bold">{c.count}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Agent performance</p>
          {stats.agents.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          {stats.agents.slice(0, 6).map((a) => (
            <div key={a.agent} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-semibold">{a.agent}</span>
              <span className="text-muted-foreground">{a.resolved}/{a.assigned}</span>
              <span className="text-muted-foreground">{formatMins(a.avgResolutionMins)}</span>
              <span className="flex items-center gap-0.5 font-bold">
                {a.avgRating ?? "—"} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">
            Platform CSAT · {stats.avgRating ?? "—"} / 5 · {stats.escalated} escalated
          </p>
        </div>

        <div className="space-y-2 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Daily trend (14d)</p>
          {stats.daily.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
          <div className="flex h-28 items-end gap-1">
            {stats.daily.map((d) => {
              const max = Math.max(1, ...stats.daily.map((x) => Math.max(x.created, x.closed)));
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-0.5" title={`${d.day}: ${d.created} created, ${d.closed} closed`}>
                  <div className="flex w-full items-end justify-center gap-0.5">
                    <div className="w-1.5 rounded-t bg-primary" style={{ height: `${(d.created / max) * 90}px` }} />
                    <div className="w-1.5 rounded-t bg-emerald-400" style={{ height: `${(d.closed / max) * 90}px` }} />
                  </div>
                  <span className="text-[8px] text-muted-foreground">{d.day.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticket ID, name, phone, email, order ID"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-2xl bg-muted/50 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/60" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-2xl bg-muted/50 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/60" />
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="rounded-2xl bg-muted/50 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/60">
            <option value="all">All agents</option>
            <option value="unassigned">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl bg-muted/50 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/60">
            <option value="all">All categories</option>
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-2xl bg-muted/50 px-3 py-2 text-xs font-semibold outline-none ring-1 ring-border/60">
            <option value="all">All priorities</option>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
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

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <DataTable
            columns={["Ticket ID", "Title", "Role", "Category", "Priority", "Contact", "Agent", "SLA", "Created", "Status", "Actions"]}
            rows={filtered.map((t) => {
              const s = ticketStatus(t);
              const sla = ticketSla(t);
              return [
                <button key={t.id + "c"} onClick={() => setSelectedId(t.id)} className="flex items-center gap-1 font-mono text-xs font-bold text-primary">
                  {t.ticket_code}
                  {(t.unread_for_agent ?? 0) > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] text-white">{t.unread_for_agent}</span>}
                </button>,
                <span key={t.id + "t"} className="font-bold">{t.title}{t.merged_into ? " · merged" : ""}</span>,
                <span key={t.id + "r"} className="text-muted-foreground">{t.role}</span>,
                <span key={t.id + "cat"} className="text-muted-foreground">{CATEGORY_LABEL[ticketCategory(t)]}</span>,
                <span key={t.id + "p"} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_TONE[ticketPriority(t)]}`}>{PRIORITY_LABEL[ticketPriority(t)]}</span>,
                <span key={t.id + "ct"} className="text-muted-foreground">{t.contact_name ?? "—"}{t.contact_phone ? ` · ${t.contact_phone}` : ""}</span>,
                <select
                  key={t.id + "ag"}
                  value={t.assigned_agent_id ?? ""}
                  onChange={(e) => e.target.value && void doAssign(t, e.target.value)}
                  className="rounded-xl bg-muted/60 px-2 py-1.5 text-xs font-bold outline-none ring-1 ring-border/60"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  {t.assigned_agent_id && !agents.some((a) => a.id === t.assigned_agent_id) && (
                    <option value={t.assigned_agent_id}>{t.assigned_agent_name ?? t.assigned_agent_id}</option>
                  )}
                </select>,
                <span key={t.id + "sla"} className={sla.overdue ? "font-bold text-rose-600" : "text-muted-foreground"}>
                  {sla.overdue ? "Overdue" : sla.breached ? "Breached" : formatMins(sla.firstResponseMins)}
                  {t.escalated ? " · esc" : ""}
                </span>,
                <span key={t.id + "d"} className="text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</span>,
                <span key={t.id + "s"} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>,
                <select
                  key={t.id + "a"}
                  value={s}
                  onChange={(e) => void changeStatus(t, e.target.value as TicketStatus)}
                  className="rounded-xl bg-muted/60 px-2 py-1.5 text-xs font-bold outline-none ring-1 ring-border/60"
                >
                  {TICKET_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
                </select>,
              ];
            })}
          />
        )}
      </section>

      {selected && (
        <TicketDetail
          ticket={selected}
          agents={agents}
          tickets={tickets}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function TicketDetail({
  ticket, agents, tickets, onClose, onChanged,
}: {
  ticket: SupportTicket;
  agents: Agent[];
  tickets: SupportTicket[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [activity, setActivity] = useState<TicketActivity[]>([]);
  const [assignments, setAssignments] = useState<TicketAssignment[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const channelVersion = useChannelVersion(`ticket:${ticket.id}`);
  const tableVersion = useTableVersion(["support_ticket_messages", "ticket_activity", "ticket_assignments"]);

  const actor = { id: user?.id ?? null, role: "admin", name: user?.email ?? user?.name ?? "Support" };

  const load = useCallback(async () => {
    const [m, a, asg] = await Promise.all([
      listTicketMessages(ticket.id, { includeInternal: true }),
      listTicketActivity(ticket.id),
      listTicketAssignments(ticket.id),
    ]);
    setMessages(m);
    setActivity(a);
    setAssignments(asg);
  }, [ticket.id]);

  useEffect(() => { void load(); }, [load, channelVersion, tableVersion]);

  useEffect(() => {
    if ((ticket.unread_for_agent ?? 0) > 0) void markTicketRead(ticket, "agent").then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    await addTicketMessage({
      ticketId: ticket.id,
      authorId: user?.id ?? "",
      authorRole: "admin",
      authorName: actor.name,
      message: reply.trim(),
      internal,
      ticket,
    });
    setReply("");
    setBusy(false);
    await load();
    onChanged();
  };

  const sla = ticketSla(ticket);
  const files = ticketAttachments(ticket);
  const mergeCandidates = tickets.filter((t) => t.id !== ticket.id && !t.merged_into).slice(0, 100);

  return (
    <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">{ticket.ticket_code}</p>
          <h2 className="mt-1 font-display text-xl font-extrabold">{ticket.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ticket.description}</p>
          <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>{CATEGORY_LABEL[ticketCategory(ticket)]}</span>
            <span>{PRIORITY_LABEL[ticketPriority(ticket)]}</span>
            <span>{STATUS_LABEL[ticketStatus(ticket)]}</span>
            <span>Agent · {ticket.assigned_agent_name ?? "unassigned"}</span>
            <span>First reply · {formatMins(sla.firstResponseMins)}</span>
            <span>Resolution · {formatMins(sla.resolutionMins)}</span>
            {ticket.order_id && <span>Order · {ticket.order_id}</span>}
            {ticket.contact_email && <span>{ticket.contact_email}</span>}
            {sla.overdue && <span className="flex items-center gap-1 font-bold text-rose-600"><AlertTriangle className="h-3 w-3" /> SLA breach</span>}
            {sla.escalateDue && !ticket.escalated && <span className="font-bold text-amber-600">Escalation due</span>}
          </p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">Close</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          onChange={async (e) => {
            const id = e.target.value;
            if (!id) return;
            const agent = agents.find((a) => a.id === id) ?? { id, name: id };
            await assignTicket(ticket, { id: agent.id, name: agent.name, role: "admin" }, actor, { transfer: !!ticket.assigned_agent_id });
            toast.success(ticket.assigned_agent_id ? "Ticket transferred" : "Ticket assigned");
            onChanged();
            void load();
          }}
          value=""
          className="rounded-2xl bg-muted/60 px-3 py-2 text-xs font-bold outline-none ring-1 ring-border/60"
        >
          <option value="">{ticket.assigned_agent_id ? "Transfer to…" : "Assign to…"}</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button
          onClick={async () => { await escalateTicket(ticket, actor, "Manual escalation"); toast.success("Escalated"); onChanged(); void load(); }}
          className="flex items-center gap-1.5 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> Escalate
        </button>
        <button
          onClick={async () => { await setTicketStatus(ticket, "resolved", actor); toast.success("Resolved"); onChanged(); }}
          className="rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700"
        >
          Resolve
        </button>
        <button
          onClick={async () => { await setTicketStatus(ticket, "closed", actor); toast.success("Closed"); onChanged(); }}
          className="rounded-2xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground"
        >
          Close ticket
        </button>
        <div className="flex items-center gap-1.5">
          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="rounded-2xl bg-muted/60 px-3 py-2 text-xs font-bold outline-none ring-1 ring-border/60">
            <option value="">Merge into…</option>
            {mergeCandidates.map((t) => <option key={t.id} value={t.id}>{t.ticket_code} · {t.title}</option>)}
          </select>
          <button
            disabled={!mergeTarget}
            onClick={async () => { await mergeTickets(ticket.id, mergeTarget, actor); toast.success("Tickets merged"); setMergeTarget(""); onChanged(); onClose(); }}
            className="flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Merge className="h-3.5 w-3.5" /> Merge
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f: string) => (
            <a key={f} href={f} target="_blank" rel="noreferrer">
              <img src={f} alt="Ticket attachment" loading="lazy" decoding="async" className="h-20 w-20 rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="space-y-2">
            {messages.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.internal ? "bg-amber-50 ring-1 ring-amber-200" : m.author_role === "admin" ? "bg-primary-soft" : "bg-muted/60"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {m.internal ? "Internal note · " : ""}{m.author_name ?? m.author_role}
                  {m.created_at ? ` · ${new Date(m.created_at).toLocaleString()}` : ""}
                </p>
                <p className="mt-0.5">{m.message}</p>
                {ticketAttachments(m).map((f: string) => (
                  <a key={f} href={f} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                    <img src={f} alt="Reply attachment" loading="lazy" decoding="async" className="h-16 w-16 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={internal ? "Add an internal note (not visible to the user)" : "Reply to the user"}
              className="flex-1 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
            />
            <button onClick={send} disabled={busy} className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5 rounded-2xl bg-muted/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Activity log</p>
            {activity.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            {activity.map((a) => (
              <p key={a.id} className="text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">{String(a.action).replace(/_/g, " ")}</span>
                {a.to_value ? ` → ${STATUS_LABEL[a.to_value] ?? a.to_value}` : ""}
                {a.actor_name ? ` · ${a.actor_name}` : a.actor_role ? ` · ${a.actor_role}` : ""}
                {a.created_at ? ` · ${new Date(a.created_at).toLocaleString()}` : ""}
              </p>
            ))}
          </div>
          <div className="space-y-1.5 rounded-2xl bg-muted/40 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <UserPlus className="h-3 w-3" /> Assignment history
            </p>
            {assignments.length === 0 && <p className="text-xs text-muted-foreground">Never assigned.</p>}
            {assignments.map((a) => (
              <p key={a.id} className="text-[11px] text-muted-foreground">
                {a.agent_name ?? a.agent_id}
                {a.created_at ? ` · ${new Date(a.created_at).toLocaleString()}` : ""}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
