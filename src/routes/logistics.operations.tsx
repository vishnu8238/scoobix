import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Filter, Camera, AlertTriangle, User, ChevronDown } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logistics/operations")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Operations" }] }),
  component: LogisticsOperations,
});

function LogisticsOperations() {
  const [activeTab, setActiveTab] = useState<"live" | "selfies" | "disputes">("live");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-muted/50 rounded-2xl w-fit">
        {[
          { id: "live", label: "Live Operations" },
          { id: "selfies", label: "Grooming Selfies" },
          { id: "disputes", label: "Disputes" }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)}
            className={cn("px-6 py-2 rounded-xl text-xs font-black transition", activeTab === t.id ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "live" ? (
        <LiveOperations />
      ) : activeTab === "selfies" ? (
        <GroomingSelfies />
      ) : (
        <DisputesView />
      )}
    </div>
  );
}

function LiveOperations() {
  return <div className="p-8 text-center text-muted-foreground">Live operations dashboard content...</div>;
}

function GroomingSelfies() {
  const [loading, setLoading] = useState(true);
  const [selfies, setSelfies] = useState<any[]>([]);

  useEffect(() => {
    listTable("grooming_selfies", { order: "created_at.desc" }).then(s => {
      setSelfies(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-black text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" /> Grooming Selfies
          <span className="bg-muted px-2 py-0.5 rounded-full text-[10px]">{selfies.length}</span>
        </h2>
        <div className="flex gap-2">
          <button className="text-xs font-black px-4 py-2 bg-muted rounded-xl">Clear Filters</button>
          <button className="text-xs font-black px-4 py-2 bg-primary text-white rounded-xl">Apply</button>
        </div>
      </div>
      {loading ? <div className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto"/></div> : 
       selfies.length === 0 ? <div className="text-center py-10 text-muted-foreground text-sm">No selfies pending review.</div> :
       <DataTable columns={["ID", "Rider", "Image", "Status"]} rows={selfies.map(s => [s.id, s.rider_name || "Unknown", "Image Link", s.status])} />}
    </div>
  );
}

function DisputesView() {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h2 className="font-display font-black text-lg flex items-center gap-2 mb-6">
        <AlertTriangle className="h-5 w-5" /> Disputes
      </h2>
      <div className="flex flex-wrap gap-4 mb-6">
        {["Dispute ID", "Reported For", "Ref Type", "Ref ID", "Status"].map(f => (
          <div key={f} className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-muted-foreground">{f}</label>
            <div className="h-10 px-3 flex items-center bg-muted rounded-xl text-xs font-bold text-muted-foreground min-w-[120px]">Any</div>
          </div>
        ))}
      </div>
      <div className="text-center py-10 text-muted-foreground text-sm">No active disputes found.</div>
    </div>
  );
}
