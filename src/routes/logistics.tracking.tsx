import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Truck, Loader2, MapPin, Search } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/logistics/tracking")({
  component: LogisticsTracking,
});

function LogisticsTracking() {
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    // Fetch orders currently in delivery phase
    const data = await listTable<any>("orders", { 
      status: "in.(PICKED_UP,ON_THE_WAY,ARRIVED)",
      order: "updated_at.desc" 
    });
    setActiveDeliveries(data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Active Delivery Tracking</h1>
        <p className="text-sm text-muted-foreground">Real-time monitoring of riders in transit.</p>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search by Order ID or Rider..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Order", "Rider", "Status", "Destination", "Last Updated"]}
            rows={activeDeliveries.filter(d => 
              d.id.toLowerCase().includes(q.toLowerCase()) || 
              (d.driver_name || "").toLowerCase().includes(q.toLowerCase())
            ).map(d => [
              <span key={d.id} className="font-bold">#{d.id.slice(-5).toUpperCase()}</span>,
              <span key={d.id} className="font-medium">{d.driver_name || "Assigned Rider"}</span>,
              <StatusBadge key={d.id} label={d.status} />,
              <div key={d.id} className="flex items-center gap-1.5 max-w-[200px] truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" /> {d.delivery_address || "Address N/A"}
              </div>,
              <span key={d.id} className="text-xs tabular-nums text-muted-foreground">
                {d.updated_at ? new Date(d.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "—"}
              </span>
            ])}
          />
        )}
      </section>
    </div>
  );
}
