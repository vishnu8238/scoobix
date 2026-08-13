import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Search, Loader2, MessageSquare, Clock, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { 
  listAllTickets, 
  type SupportTicket, 
  setTicketStatus, 
  listTicketRatings,
  ticketStatus,
  ticketPriority,
  STATUS_LABEL,
  STATUS_TONE,
  computeSupportAnalytics
} from "@/lib/support-api";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { toast } from "sonner";
import { useTableVersion } from "@/lib/realtime-hooks";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/logistics/support")({
  head: () => ({ meta: [
    { title: "Scoobix Logistics · Support Tickets" },
    { name: "description", content: "Platform-wide support ticket management for customers and partners." },
  ] }),
  component: LogisticsSupport,
});

function LogisticsSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const version = useTableVersion(["support_tickets"]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([listAllTickets(), listTicketRatings()]);
      setTickets(t);
      setRatings(r);
    } catch {
      toast.error("Failed to load support data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  const filtered = tickets.filter(t => {
    const matchesQ = (t.title || "" + t.description || "").toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticketStatus(t) === statusFilter;
    return matchesQ && matchesStatus;
  });

  const analytics = computeSupportAnalytics(tickets, ratings);

  const stats = [
    { label: "Open Tickets", value: analytics.open, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
    { label: "Breached SLA", value: analytics.breached, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Resolved", value: analytics.closed, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Avg Rating", value: analytics.avgRating ?? "—", icon: AlertCircle, color: "text-purple-600 bg-purple-50" },
  ];

  const changeStatus = async (t: SupportTicket, status: any) => {
    const actor = { id: user?.id ?? null, role: "admin", name: user?.email ?? user?.name ?? "Logistics" };
    await setTicketStatus(t, status, actor);
    toast.success(`${t.ticket_code} → ${STATUS_LABEL[status]}`);
    void load();
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Customer & Partner Success</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Support Desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage and resolve inquiries across the entire ecosystem.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="font-display text-2xl font-extrabold">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search by title or description..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <DataTable
            columns={["Ticket", "Requester", "Subject", "Status", "Priority", "Created", "Actions"]}
            rows={filtered.map(t => {
              const s = ticketStatus(t);
              const p = ticketPriority(t);
              return [
                <span key={t.id} className="font-mono text-[10px] font-bold uppercase text-primary">{t.ticket_code || t.id.slice(0, 8)}</span>,
                <div key={t.id+"u"} className="flex flex-col">
                  <span className="text-xs font-bold">{t.contact_name || t.created_by?.slice(0, 8) || "—"}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{t.role || "user"}</span>
                </div>,
                <p key={t.id+"s"} className="max-w-[200px] truncate text-xs font-medium">{t.title}</p>,
                <span key={t.id+"st"} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>,
                <span key={t.id+"p"} className={`text-[10px] font-bold uppercase ${p === 'urgent' ? 'text-rose-600' : 'text-muted-foreground'}`}>{p}</span>,
                <span key={t.id+"c"} className="text-[10px] text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</span>,
                <div key={t.id+"a"} className="flex gap-2">
                  <select
                    value={s}
                    onChange={(e) => void changeStatus(t, e.target.value)}
                    className="rounded-xl bg-muted/60 px-2 py-1.5 text-xs font-bold outline-none ring-1 ring-border/60"
                  >
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              ];
            })}
          />
        )}
      </section>
    </div>
  );
}
