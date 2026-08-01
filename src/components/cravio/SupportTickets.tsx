/**
 * Shared support-ticket surface used by the customer, partner and rider apps.
 * Same design language as the rest of the app: rounded cards + soft rings.
 */
import { useCallback, useEffect, useState } from "react";
import { useTableVersion, useChannelVersion } from "@/lib/realtime-hooks";
import { Loader2, MessageSquarePlus, Send, LifeBuoy, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import {
  addTicketMessage,
  createTicket,
  listMyTickets,
  listTicketMessages,
  ticketAttachments,
  ticketStatus,
  updateTicket,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type SupportTicket,
  type TicketMessage,
  type TicketPriority,
  type TicketRole,
} from "@/lib/support-api";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import type { ImageRef } from "@/lib/image-service";

const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export function SupportTickets({ role, intro }: { role: TicketRole; intro?: string }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  // Realtime: tickets and replies land without a refresh.
  const version = useTableVersion(["support_tickets", "support_ticket_messages"]);

  const refresh = useCallback(async () => {
    if (!user?.id) { setTickets([]); setLoading(false); return; }
    setLoading(true);
    setTickets(await listMyTickets(user.id));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh, version]);

  if (!user) {
    return (
      <div className="mx-4 mt-4 rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
        <LifeBuoy className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 text-sm font-bold">Sign in to raise a ticket</p>
        <p className="mt-1 text-xs text-muted-foreground">Your support history is tied to your account.</p>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 space-y-4 pb-8">
      {intro && <p className="text-xs text-muted-foreground">{intro}</p>}

      {composing ? (
        <NewTicketForm
          role={role}
          userId={user.id}
          contactName={user.name}
          contactPhone={user.phone}
          onCancel={() => setComposing(false)}
          onCreated={() => { setComposing(false); void refresh(); }}
        />
      ) : (
        <button
          onClick={() => setComposing(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <MessageSquarePlus className="h-4 w-4" /> Raise a ticket
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
          <LifeBuoy className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 text-sm font-bold">No tickets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Raise a ticket and our team will reply here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => <TicketCard key={t.id} ticket={t} role={role} userId={user.id} onChange={refresh} />)}
        </ul>
      )}
    </div>
  );
}

function NewTicketForm({
  role, userId, contactName, contactPhone, onCancel, onCreated,
}: {
  role: TicketRole; userId: string; contactName?: string; contactPhone?: string;
  onCancel: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [attachment, setAttachment] = useState<ImageRef | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Add a title and description"); return; }
    setSaving(true);
    const created = await createTicket({
      title: title.trim(),
      description: description.trim(),
      role,
      createdBy: userId,
      priority,
      attachments: attachment?.image_url ? [attachment.image_url] : [],
      contactName,
      contactPhone,
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
      <div className="flex flex-wrap gap-2">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${priority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Attachment (optional)</p>
        <ImageUploader type="banner" value={attachment} onChange={setAttachment} label="Add screenshot" aspect="aspect-[16/9]" />
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

function TicketCard({ ticket, role, userId, onChange }: { ticket: SupportTicket; role: TicketRole; userId: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const status = ticketStatus(ticket);
  // One scoped channel per open conversation — instant for every role.
  const msgVersion = useChannelVersion(open ? `ticket:${ticket.id}` : null);
  const tableVersion = useTableVersion(open ? ["support_ticket_messages"] : []);

  useEffect(() => {
    if (!open) return;
    void listTicketMessages(ticket.id).then(setMessages);
  }, [open, ticket.id, msgVersion, tableVersion]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    await addTicketMessage({ ticketId: ticket.id, authorId: userId, authorRole: role, message: reply.trim() });
    setReply("");
    setMessages(await listTicketMessages(ticket.id));
    setBusy(false);
  };

  const closeTicket = async () => {
    await updateTicket(ticket.id, { status: "closed" });
    toast.success("Ticket closed");
    onChange();
  };

  const files = ticketAttachments(ticket);

  return (
    <li className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{ticket.ticket_code}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_TONE[ticket.priority ?? "normal"] ?? PRIORITY_TONE.normal}`}>{ticket.priority ?? "normal"}</span>
          </div>
          <div className="mt-1 truncate text-sm font-bold">{ticket.title}</div>
          <div className="truncate text-xs text-muted-foreground">{ticket.description}</div>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-4 py-3">
          {files.length > 0 && (
            <div className="flex gap-2">
              {files.map((f) => <img key={f} src={f} alt="Ticket attachment" className="h-16 w-16 rounded-xl object-cover" />)}
            </div>
          )}
          <div className="space-y-2">
            {messages.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.author_role === "admin" ? "bg-primary-soft text-foreground" : "bg-muted/60"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.author_role === "admin" ? "Support team" : "You"}</p>
                <p className="mt-0.5">{m.message}</p>
              </div>
            ))}
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
              <button onClick={closeTicket} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Close ticket</button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
