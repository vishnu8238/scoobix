import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Sparkles, Search, Plus, Loader2, Calendar, Target, Award, MapPin, Edit2, Trash2 } from "lucide-react";
import { fetchGigs, type Gig } from "@/lib/gigs-api";
import { listTable } from "@/lib/insforge-crud";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/gigs")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Gig Management" }] }),
  component: LogisticsGigs,
});

function LogisticsGigs() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTable("gigs", {
        order: "created_at.desc",
        limit: 200
      });
      setGigs(data || []);
    } catch (err: any) {
      console.error("[GIGS_LOAD]", err);
      toast.error(`Failed to load gigs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Incentives</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Gigs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure delivery incentives and limited-time targets.</p>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> Create Gig
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search by title, zone..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : gigs.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-bold">No gigs found</p>
            <p className="text-xs text-muted-foreground">Create your first delivery incentive to get started.</p>
          </div>
        ) : (
          <DataTable
            columns={["Gig", "Reward", "Target", "Status", "Schedule", "Location", "Actions"]}
            rows={gigs.filter(g => g.title.toLowerCase().includes(q.toLowerCase())).map(g => [
              <div key={g.id+"tit"} className="flex flex-col">
                <span className="font-bold text-sm">{g.title}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">{g.description}</span>
              </div>,
              <div key={g.id+"rew"} className="flex items-center gap-1 font-black text-emerald-600">
                <Award className="h-3 w-3" />
                ₹{g.reward_amount}
              </div>,
              <div key={g.id+"trg"} className="flex items-center gap-1 font-bold">
                <Target className="h-3 w-3" />
                {g.target_deliveries} Orders
              </div>,
              <StatusBadge key={g.id+"st"} label={g.status} />,
              <div key={g.id+"sch"} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(g.start_time), "MMM d")} - {format(new Date(g.end_time), "MMM d")}
              </div>,
              <div key={g.id+"loc"} className="flex items-center gap-1 text-[10px] font-bold">
                <MapPin className="h-3 w-3" />
                {g.zone_id ? "Specific Zone" : "All Zones"}
              </div>,
              <div key={g.id+"act"} className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-muted rounded-lg"><Edit2 className="h-4 w-4" /></button>
                <button className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg"><Trash2 className="h-4 w-4" /></button>
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
