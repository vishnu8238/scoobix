import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { History, Search, Loader2, Calendar, User, ShieldAlert } from "lucide-react";
import { fetchAuditLogs, type AuditLog } from "@/lib/audit-logs-api";

export const Route = createFileRoute("/logistics/audit")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Operational Audit Logs" }] }),
  component: LogisticsAuditLogs,
});

function LogisticsAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ limit: 500 });
      setLogs(data || []);
    } catch (err: any) {
      console.error("[AUDIT] Load failed:", err);
      toast.error(`Failed to load audit logs: ${err.message || "Unknown error"}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(q.toLowerCase()) || 
    l.entity.toLowerCase().includes(q.toLowerCase()) ||
    (l.reason || "").toLowerCase().includes(q.toLowerCase()) ||
    (l.admin_name || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Immutable history of platform operations and overrides.</p>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search by action, admin, reason..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <History className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-bold text-muted-foreground">No audit logs available</p>
            <p className="text-[10px] text-muted-foreground mt-1">Goverance records will appear here as overrides occur.</p>
          </div>
        ) : (
          <DataTable
            columns={["Action", "Entity", "Admin", "Change", "Reason", "Timestamp"]}
            rows={filtered.map(l => [
              <div key={l.id+"act"} className="flex flex-col">
                <span className="font-bold text-xs">{l.action}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{l.id.slice(0, 8)}</span>
              </div>,
              <span key={l.id+"ent"} className="font-medium text-xs uppercase">{l.entity}</span>,
              <div key={l.id+"adm"} className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-bold">{l.admin_name || l.admin_id.slice(0, 8)}</span>
              </div>,
              <div key={l.id+"val"} className="max-w-[200px] truncate text-[10px]">
                {l.previous_value !== undefined && <span className="text-rose-500 line-through mr-1">{JSON.stringify(l.previous_value)}</span>}
                <span className="text-emerald-600 font-bold">{JSON.stringify(l.new_value)}</span>
              </div>,
              <p key={l.id+"res"} className="text-[10px] text-muted-foreground italic max-w-[200px] line-clamp-2">{l.reason || "No reason provided"}</p>,
              <div key={l.id+"ts"} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(l.timestamp).toLocaleString()}
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
