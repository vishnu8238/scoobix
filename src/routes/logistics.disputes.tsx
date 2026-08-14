import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Search, Filter, CheckCircle2, XCircle, Clock } from "lucide-react";
import { fetchDisputes, updateDisputeStatus, type Dispute } from "@/lib/logistics-ops-api";
import { useTableVersion } from "@/lib/realtime-hooks";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/disputes")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Disputes" }] }),
  component: LogisticsDisputes,
});

function LogisticsDisputes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [filter, setFilter] = useState<Dispute["status"] | "all">("all");
  const [q, setQ] = useState("");
  const version = useTableVersion(["operational_disputes"]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchDisputes();
    setDisputes(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  const handleStatus = async (id: string, status: Dispute["status"]) => {
    const ok = await updateDisputeStatus(id, status, "Processed by Logistics", user?.name || "Logistics");
    if (ok) {
      toast.success(`Dispute marked as ${status}`);
      void load();
    }
  };

  const filtered = disputes.filter(d => {
    const matchStatus = filter === "all" || d.status === filter;
    const matchSearch = d.id.includes(q) || d.subject.toLowerCase().includes(q.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Operational Disputes
          </h1>
          <p className="text-sm text-muted-foreground">Manage and resolve platform conflicts.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {["all", "pending", "investigating", "resolved", "rejected"].map((s) => (
          <button 
            key={s} 
            onClick={() => setFilter(s as any)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition uppercase tracking-wider ${filter === s ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search disputes by ID or subject..."
              className="w-full rounded-2xl bg-muted/40 py-2 pl-10 pr-4 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <DataTable 
            columns={["ID", "Subject", "Ref Type", "Priority", "Status", "Created", "Actions"]}
            rows={filtered.map(d => [
              <span key={d.id} className="font-mono text-[10px] font-bold text-primary">#{d.id.slice(0,8)}</span>,
              <div key={d.id+"sub"} className="max-w-xs">
                <p className="font-bold truncate">{d.subject}</p>
                <p className="text-[10px] text-muted-foreground truncate">{d.description}</p>
              </div>,
              <span key={d.id+"et"} className="text-[10px] font-bold uppercase text-muted-foreground">{d.entity_type}</span>,
              <StatusBadge key={d.id+"p"} label={d.priority} />,
              <StatusBadge key={d.id+"s"} label={d.status} />,
              <span key={d.id+"c"} className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</span>,
              <div key={d.id+"a"} className="flex gap-1.5">
                <button onClick={() => handleStatus(d.id, "investigating")} className="p-1.5 rounded-full bg-amber-100 text-amber-700 hover:scale-110 transition active:scale-95" title="Investigate"><Clock className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleStatus(d.id, "resolved")} className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:scale-110 transition active:scale-95" title="Resolve"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleStatus(d.id, "rejected")} className="p-1.5 rounded-full bg-rose-100 text-rose-700 hover:scale-110 transition active:scale-95" title="Reject"><XCircle className="h-3.5 w-3.5" /></button>
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
