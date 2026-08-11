import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DataTable } from "@/components/cravio/AdminTable";
import { History, Loader2, User, Terminal } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/logistics/audit")({
  component: LogisticsAudit,
});

function LogisticsAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production we'd fetch from loyalty_audit_logs or a dedicated logistics_audit table
    const load = async () => {
      const data = await listTable<any>("loyalty_audit_logs", { limit: 50, order: "timestamp.desc" });
      setLogs(data);
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Immutable history of logistics interventions and configuration changes.</p>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Timestamp", "Operator", "Entity", "Action", "Detail"]}
            rows={logs.map((l, i) => [
              <span key={i} className="text-xs text-muted-foreground tabular-nums">{new Date(l.timestamp).toLocaleString()}</span>,
              <div key={i} className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> <span className="font-medium text-xs">Admin-{l.admin_id?.slice(-4)}</span></div>,
              <span key={i} className="text-[10px] font-bold uppercase px-2 py-0.5 bg-muted rounded-full">{l.entity}</span>,
              <span key={i} className="font-bold text-xs">{l.action}</span>,
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground max-w-xs truncate">
                <Terminal className="h-3 w-3 shrink-0" /> {l.reason || `Modified ${l.entity_id.slice(-8)}`}
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
