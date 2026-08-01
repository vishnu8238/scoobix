import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { SupportTickets } from "@/components/cravio/SupportTickets";
import { useAuth } from "@/lib/auth-store";
import { useManager, useManagerRestaurants } from "@/lib/manager-api";
import { useTableVersion, useChannelVersion } from "@/lib/realtime-hooks";
import {
  addTicketMessage,
  escalateTicket,
  formatMins,
  listAllTickets,
  listTicketMessages,
  markTicketRead,
  matchesTicket,
  setTicketStatus,
  ticketPriority,
  ticketSla,
  ticketStatus,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type SupportTicket,
  type TicketMessage,
} from "@/lib/support-api";

export const Route = createFileRoute("/manager/support")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Restaurant support" },
      { name: "description", content: "Support tickets raised by the restaurants assigned to you — reply, resolve or escalate." },
      { property: "og:title", content: "Scoobix Merchant Manager · Restaurant support" },
      { property: "og:description", content: "Reply, resolve or escalate tickets from your assigned restaurants." },
    ],
  }),
  component: ManagerSupport,
});

function ManagerSupport() {
  const { manager } = useManager();
  const { list: restaurants } = useManagerRestaurants(manager?.id);
  const [all, setAll] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"restaurants" | "mine">("restaurants");
  const [openId, setOpenId] = useState<string | null>(null);
  const version = useTableVersion(["support_tickets", "support_ticket_messages"]);

  const refresh = useCallback(async () => {
    if (!manager?.id) return;
    setAll(await listAllTickets());
    setLoading(false);
  }, [manager?.id]);

  useEffect(() => { void refresh(); }, [refresh, version]);

  const tickets = useMemo(() => {
    const owners = new Set(restaurants.map((r) => r.owner_id).filter(Boolean) as string[]);
    const ids = new Set(restaurants.map((r) => r.id));
    return all
      .filter(
        (t) =>
          (t.created_by && owners.has(t.created_by)) ||
          (t.reference_id && ids.has(t.reference_id)) ||
          (t.restaurant_id && ids.has(t.restaurant_id)),
      )
      .filter((t) => matchesTicket(t, q));
  }, [all, restaurants, q]);

  const nameFor = (t: SupportTicket) =>
    restaurants.find((r) => r.owner_id === t.created_by || r.id === t.reference_id || r.id === t.restaurant_id)?.name ??
    t.contact_name ??
    "Restaurant";

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="Support" subtitle={`${tickets.length} restaurant tickets`} />

      <div className="flex gap-2 px-5 pt-4">
        {(["restaurants", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {t === "restaurants" ? "My restaurants" : "My tickets"}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <SupportTickets role="manager" intro="Raise a ticket with the Scoobix platform team." />
      ) : (
        <div className="space-y-2.5 px-5 pt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticket ID, restaurant, phone, order"
            className="w-full rounded-2xl bg-muted/50 px-4 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
          />
          {loading && <div className="h-20 animate-pulse rounded-3xl bg-muted/60" />}
          {!loading && tickets.length === 0 && (
            <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
              <LifeBuoy className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">No open tickets</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Tickets raised by your assigned restaurants will appear here.
              </p>
            </div>
          )}
          {tickets.map((t) => (
            <ManagerTicketCard
              key={t.id}
              ticket={t}
              restaurantName={nameFor(t)}
              open={openId === t.id}
              onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManagerTicketCard({
  ticket, restaurantName, open, onToggle, onChanged,
}: {
  ticket: SupportTicket;
  restaurantName: string;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { manager } = useManager();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = ticketStatus(ticket);
  const sla = ticketSla(ticket);
  const channelVersion = useChannelVersion(open ? `ticket:${ticket.id}` : null);
  const tableVersion = useTableVersion(open ? ["support_ticket_messages"] : []);

  const actor = {
    id: user?.id ?? null,
    role: "manager",
    name: manager?.name ?? user?.name ?? user?.email ?? "Merchant manager",
  };

  useEffect(() => {
    if (!open) return;
    void listTicketMessages(ticket.id, { includeInternal: true }).then(setMessages);
    if ((ticket.unread_for_agent ?? 0) > 0) void markTicketRead(ticket, "agent").then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket.id, channelVersion, tableVersion]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    await addTicketMessage({
      ticketId: ticket.id,
      authorId: user?.id ?? "",
      authorRole: "manager",
      authorName: actor.name,
      message: reply.trim(),
      internal,
      ticket,
    });
    setReply("");
    setMessages(await listTicketMessages(ticket.id, { includeInternal: true }));
    setBusy(false);
    onChanged();
  };

  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{ticket.title}</p>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[s]}`}>
            {STATUS_LABEL[s]}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {restaurantName} · {ticket.ticket_code}
        </p>
        {ticket.description && <p className="mt-2 line-clamp-3 text-[13px] text-muted-foreground">{ticket.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_TONE[ticketPriority(ticket)]}`}>
            {PRIORITY_LABEL[ticketPriority(ticket)]}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABEL[ticket.category ?? "other"]}
          </span>
          {sla.overdue && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-rose-600">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
          {(ticket.unread_for_agent ?? 0) > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {ticket.unread_for_agent}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <p className="text-[11px] text-muted-foreground">
            First reply {formatMins(sla.firstResponseMins)}
            {ticket.contact_phone ? " · " : ""}
            {ticket.contact_phone && (
              <a href={`tel:${ticket.contact_phone}`} className="font-bold text-primary">Call restaurant</a>
            )}
          </p>

          <div className="space-y-2">
            {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.internal ? "bg-amber-50 ring-1 ring-amber-200" : m.author_role === "restaurant" ? "bg-muted/60" : "bg-primary-soft"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {m.internal ? "Internal note · " : ""}{m.author_name ?? m.author_role}
                </p>
                <p className="mt-0.5">{m.message}</p>
              </div>
            ))}
          </div>

          {s !== "closed" && (
            <>
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={internal ? "Internal note" : "Reply to the restaurant"}
                  className="flex-1 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
                />
                <button onClick={send} disabled={busy} className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => { await setTicketStatus(ticket, "resolved", actor); toast.success("Marked resolved"); onChanged(); }}
                  className="rounded-2xl bg-emerald-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700"
                >
                  Resolve
                </button>
                <button
                  onClick={async () => { await escalateTicket(ticket, actor, "Escalated by merchant manager"); toast.success("Escalated to admin"); onChanged(); }}
                  className="flex items-center gap-1.5 rounded-2xl bg-amber-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-700"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Escalate to admin
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
