/**
 * Shared support-ticket surface used by the customer, partner, rider and
 * merchant-manager apps. Same design language as the rest of the app:
 * rounded cards + soft rings.
 *
 * Everything is InsForge backed: tickets, replies, attachments, activity and
 * post-closure ratings. Realtime keeps threads live without a refresh.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTableVersion, useChannelVersion } from "@/lib/realtime-hooks";
import {
  Loader2,
  MessageSquarePlus,
  Send,
  LifeBuoy,
  ChevronDown,
  Star,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  addTicketMessage,
  createTicket,
  listMyTickets,
  listTicketMessages,
  listTicketActivity,
  getTicketRating,
  rateTicket,
  markTicketRead,
  setTicketStatus,
  suggestPriority,
  ticketAttachments,
  ticketPriority,
  ticketSla,
  ticketStatus,
  formatMins,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type SupportTicket,
  type TicketActivity,
  type TicketCategory,
  type TicketMessage,
  type TicketPriority,
  type TicketRating,
  type TicketRole,
} from "@/lib/support-api";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import type { ImageRef } from "@/lib/image-service";

export function SupportTickets({ role, intro }: { role: TicketRole; intro?: string }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<"active" | "history">("active");
  // Realtime: tickets and replies land without a refresh.
  const version = useTableVersion(["support_tickets", "support_ticket_messages"]);

  const refresh = useCallback(async () => {
    if (!user?.id) { setTickets([]); setLoading(false); return; }
    setTickets(await listMyTickets(user.id));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh, version]);

  const active = useMemo(
    () => tickets.filter((t) => !["resolved", "closed"].includes(ticketStatus(t))),
    [tickets],
  );
  const history = useMemo(
    () => tickets.filter((t) => ["resolved", "closed"].includes(ticketStatus(t))),
    [tickets],
  );
  const unread = useMemo(
    () => tickets.reduce((n, t) => n + (t.unread_for_owner ?? 0), 0),
    [tickets],
  );

  if (!user) {
    return (
      <div className="mx-4 mt-4 rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
        <LifeBuoy className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 text-sm font-bold">Sign in to raise a ticket</p>
        <p className="mt-1 text-xs text-muted-foreground">Your support history is tied to your account.</p>
      </div>
    );
  }

  const shown = tab === "active" ? active : history;

  return (
    <div className="mx-4 mt-4 space-y-4 pb-8">
      {intro && <p className="text-xs text-muted-foreground">{intro}</p>}

      {composing ? (
        <NewTicketForm
          role={role}
          userId={user.id}
          contactName={user.name}
          contactPhone={user.phone}
          contactEmail={user.email}
          onCancel={() => setComposing(false)}
          onCreated={() => { setComposing(false); setTab("active"); void refresh(); }}
        />
      ) : (
        <button
          onClick={() => setComposing(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <MessageSquarePlus className="h-4 w-4" /> Raise a ticket
        </button>
      )}

      <div className="flex gap-2">
        {(["active", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {t === "active" ? `Active ${active.length ? `(${active.length})` : ""}` : `History ${history.length ? `(${history.length})` : ""}`}
            {t === "active" && unread > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
          <LifeBuoy className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 text-sm font-bold">{tab === "active" ? "No open tickets" : "No past tickets"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Raise a ticket and our team will reply here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => <TicketCard key={t.id} ticket={t} role={role} userId={user.id} userName={user.name} onChange={refresh} />)}
        </ul>
      )}
    </div>
  );
}

function NewTicketForm({
  role, userId, contactName, contactPhone, contactEmail, onCancel, onCreated,
}: {
  role: TicketRole; userId: string; contactName?: string; contactPhone?: string; contactEmail?: string;
  onCancel: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("orders");
  const [priority, setPriority] = useState<TicketPriority>(suggestPriority("orders"));
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [attachment, setAttachment] = useState<ImageRef | null>(null);
  const [docAttachment, setDocAttachment] = useState<ImageRef | null>(null);
  const [saving, setSaving] = useState(false);

  const pickCategory = (c: TicketCategory) => {
    setCategory(c);
    if (!priorityTouched) setPriority(suggestPriority(c));
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Add a title and description"); return; }
    setSaving(true);
    const created = await createTicket({
      title: title.trim(),
      description: description.trim(),
      category,
      role,
      created_by: userId,
      priority,
      attachments: attachment?.image_url ? [attachment.image_url] : [],
      documents: docAttachment?.image_url ? [docAttachment.image_url] : [],
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      order_id: orderId.trim() || undefined,
    });
    setSaving(false);
    if (!created) { toast.error("Could not create ticket. Try again."); return; }
    toast.success(`Ticket ${created.ticket_code ?? ""} created`);
    onCreated();
  };

  return (
    <div className="space-y-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <p className="font-display text-sm font-bold">New support ticket</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What went wrong?"
        className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        placeholder="Describe the issue in detail"
        className="w-full resize-none rounded-2xl bg-muted/50 px-4 py-3 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
      />

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Category</p>
        <div className="flex flex-wrap gap-2">
          {TICKET_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => pickCategory(c)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Priority · suggested {PRIORITY_LABEL[suggestPriority(category)]}
        </p>
        <div className="flex flex-wrap gap-2">
          {TICKET_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => { setPriority(p); setPriorityTouched(true); }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${priority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <input
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        placeholder="Related order ID (optional)"
        className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
      />

      <div className="grid gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Screenshot (optional)</p>
          <ImageUploader type="banner" value={attachment} onChange={setAttachment} label="Add screenshot" aspect="aspect-[16/9]" />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Document / proof (optional)</p>
          <ImageUploader type="banner" value={docAttachment} onChange={setDocAttachment} label="Add document" aspect="aspect-[16/9]" />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
        </button>
        <button onClick={onCancel} className="flex-1 rounded-2xl bg-muted px-4 py-2.5 text-sm font-bold text-muted-foreground transition active:scale-95">Cancel</button>
      </div>
    </div>
  );
}

function TicketCard({
  ticket, role, userId, userName, onChange,
}: {
  ticket: SupportTicket; role: TicketRole; userId: string; userName?: string; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [activity, setActivity] = useState<TicketActivity[]>([]);
  const [rating, setRating] = useState<TicketRating | null>(null);
  const [reply, setReply] = useState("");
  const [replyImage, setReplyImage] = useState<ImageRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const status = ticketStatus(ticket);
  const sla = ticketSla(ticket);
  const unread = ticket.unread_for_owner ?? 0;
  // One scoped channel per open conversation — instant for every role.
  const msgVersion = useChannelVersion(open ? `ticket:${ticket.id}` : null);
  const tableVersion = useTableVersion(open ? ["support_ticket_messages", "ticket_activity"] : []);

  useEffect(() => {
    if (!open) return;
    void listTicketMessages(ticket.id).then(setMessages);
    void listTicketActivity(ticket.id).then(setActivity);
    void getTicketRating(ticket.id).then(setRating);
  }, [open, ticket.id, msgVersion, tableVersion]);

  useEffect(() => {
    if (open && unread > 0) void markTicketRead(ticket, "owner").then(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    await addTicketMessage({
      ticketId: ticket.id,
      authorId: userId,
      authorRole: role,
      authorName: userName,
      message: reply.trim(),
      attachments: replyImage?.image_url ? [replyImage.image_url] : [],
      ticket,
    });
    setReply("");
    setReplyImage(null);
    setMessages(await listTicketMessages(ticket.id));
    setBusy(false);
    onChange();
  };

  const changeStatus = async (next: "closed" | "reopened") => {
    await setTicketStatus(ticket, next, { id: userId, role, name: userName });
    toast.success(next === "closed" ? "Ticket closed" : "Ticket reopened");
    onChange();
  };

  const submitRating = async (stars: number) => {
    await rateTicket({
      ticketId: ticket.id,
      userId,
      rating: stars,
      agentId: ticket.assigned_agent_id ?? null,
    });
    setRating(await getTicketRating(ticket.id));
    toast.success("Thanks for rating our support");
  };

  const files = ticketAttachments(ticket);
  const canRate = (status === "closed" || status === "resolved") && role === "customer";

  return (
    <li className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{ticket.ticket_code}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_TONE[ticketPriority(ticket)]}`}>{PRIORITY_LABEL[ticketPriority(ticket)]}</span>
            {unread > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread}</span>
            )}
            {sla.overdue && (
              <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-bold">{ticket.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {CATEGORY_LABEL[ticket.category ?? "other"]} · {ticket.description}
          </div>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> First reply {formatMins(sla.firstResponseMins)}</span>
            {sla.resolutionMins !== null && <span>Resolved in {formatMins(sla.resolutionMins)}</span>}
            {ticket.assigned_agent_name && <span>Agent · {ticket.assigned_agent_name}</span>}
            {ticket.order_id && <span>Order · {ticket.order_id}</span>}
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f: string) => (
                <a key={f} href={f} target="_blank" rel="noreferrer">
                  <img src={f} alt="Ticket attachment" loading="lazy" decoding="async" className="h-16 w-16 rounded-xl object-cover" />
                </a>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
            {messages.map((m) => {
              const mine = m.author_id === userId;
              const msgFiles = ticketAttachments(m);
              return (
                <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-muted/60" : "bg-primary-soft text-foreground"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {mine ? "You" : m.author_name ?? "Support team"}
                  </p>
                  <p className="mt-0.5">{m.message}</p>
                  {msgFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msgFiles.map((f: string) => (
                        <a key={f} href={f} target="_blank" rel="noreferrer">
                          <img src={f} alt="Reply attachment" loading="lazy" decoding="async" className="h-14 w-14 rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {status !== "closed" && (
            <>
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply"
                  className="flex-1 rounded-2xl bg-muted/50 px-4 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40"
                />
                <button onClick={send} disabled={busy} className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <ImageUploader type="banner" value={replyImage} onChange={setReplyImage} label="Attach image / proof" aspect="aspect-[16/9]" />
              <button onClick={() => void changeStatus("closed")} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Close ticket</button>
            </>
          )}

          {status === "closed" && (
            <button
              onClick={() => void changeStatus("reopened")}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"
            >
              <RotateCcw className="h-3 w-3" /> Reopen ticket
            </button>
          )}

          {canRate && (
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {rating ? "Your rating" : "Rate our support"}
              </p>
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    disabled={!!rating}
                    onClick={() => void submitRating(s)}
                    className="transition active:scale-90 disabled:cursor-default"
                    aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
                  >
                    <Star className={`h-5 w-5 ${(rating?.rating ?? 0) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowTimeline((v) => !v)}
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {showTimeline ? "Hide timeline" : "View timeline"}
          </button>
          {showTimeline && (
            <ul className="space-y-1.5 border-l border-border/60 pl-3">
              {activity.length === 0 && <li className="text-[11px] text-muted-foreground">No activity yet.</li>}
              {activity.map((a) => (
                <li key={a.id} className="text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">{String(a.action).replace(/_/g, " ")}</span>
                  {a.to_value ? ` → ${STATUS_LABEL[a.to_value] ?? a.to_value}` : ""}
                  {a.actor_role ? ` · ${a.actor_role}` : ""}
                  {a.created_at ? ` · ${new Date(a.created_at).toLocaleString()}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
