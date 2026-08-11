import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { AlertTriangle, Loader2, Clock, MapPin, UserCheck } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/logistics/exceptions")({
  component: LogisticsExceptions,
});

function LogisticsExceptions() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Mocking exceptions based on delayed orders or unassigned ones past timeout
    const data = await listTable<any>("orders", { 
      status: "in.(PLACED,CONFIRMED,ACCEPTED,PREPARING,READY)",
      order: "created_at.asc" // Oldest first
    });
    setExceptions(data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-rose-500 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" /> Operational Exceptions
        </h1>
        <p className="text-sm text-muted-foreground">Orders requiring immediate intervention (Delays, No Riders, Cancellations).</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl bg-rose-50 p-6 ring-1 ring-rose-200">
          <h3 className="text-rose-600 font-bold mb-2">High Latency</h3>
          <p className="text-3xl font-display font-extrabold text-rose-700">{exceptions.length}</p>
          <p className="text-[10px] uppercase font-bold text-rose-500">Awaiting Assignment &gt; 5m</p>
        </div>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Order", "Time in Queue", "Issue", "Action"]}
            rows={exceptions.map(o => [
              <span key={o.id} className="font-bold">#{o.id.slice(-5).toUpperCase()}</span>,
              <div key={o.id} className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <Clock className="h-3 w-3" /> 12m 45s
              </div>,
              <div key={o.id} className="flex flex-col">
                <span className="text-xs font-bold">Rider Availability Low</span>
                <span className="text-[10px] text-muted-foreground">Zone: North Hub</span>
              </div>,
              <div key={o.id} className="flex gap-2">
                <button className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-glow">Manual Assign</button>
                <button className="bg-muted text-foreground text-[10px] font-bold px-3 py-1.5 rounded-lg">Call Rider</button>
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
