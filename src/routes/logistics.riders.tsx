import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Bike, Loader2, MapPin, Activity, Shield } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/logistics/riders")({
  component: LogisticsRiders,
});

function LogisticsRiders() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listTable<any>("drivers", { order: "created_at.desc" });
    setRiders(data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Rider Management</h1>
        <p className="text-sm text-muted-foreground">Monitor fleet health, compliance, and real-time availability.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <Activity className="h-5 w-5" />
            <h3 className="font-bold">Active Fleet</h3>
          </div>
          <p className="text-3xl font-display font-extrabold">{riders.filter(r => r.online_status).length}</p>
          <p className="text-xs text-muted-foreground">Riders currently online</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3 mb-4 text-emerald-500">
            <Shield className="h-5 w-5" />
            <h3 className="font-bold">Verified</h3>
          </div>
          <p className="text-3xl font-display font-extrabold">{riders.filter(r => r.verification_status === "VERIFIED").length}</p>
          <p className="text-xs text-muted-foreground">Riders with cleared KYC</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-3 mb-4 text-amber-500">
            <MapPin className="h-5 w-5" />
            <h3 className="font-bold">Total Hubs</h3>
          </div>
          <p className="text-3xl font-display font-extrabold">{new Set(riders.map(r => r.zone_id)).size}</p>
          <p className="text-xs text-muted-foreground">Operational delivery zones</p>
        </div>
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Rider", "Vehicle", "Status", "Zone", "Rating", "Action"]}
            rows={riders.map(r => [
              <div key={r.id} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Bike className="h-4 w-4" /></div>
                <div>
                  <p className="font-bold">{r.name || "Unnamed Rider"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{r.id.slice(-8)}</p>
                </div>
              </div>,
              <div key={r.id} className="text-sm">{r.vehicle_number || "—"} <span className="text-[10px] bg-muted px-1.5 rounded ml-1">{r.vehicle_type}</span></div>,
              <StatusBadge key={r.id} label={r.online_status ? "ONLINE" : "OFFLINE"} />,
              <span key={r.id} className="text-sm font-medium">{r.zone_name || "Unassigned"}</span>,
              <span key={r.id} className="font-display font-extrabold text-amber-500">{r.rating || "5.0"}★</span>,
              <button key={r.id} className="p-2 hover:bg-muted rounded-xl transition"><Activity className="h-4 w-4" /></button>
            ])}
          />
        )}
      </section>
    </div>
  );
}
