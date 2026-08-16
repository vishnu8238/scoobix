import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, Clock, Users, ArrowRight, BarChart3, AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { toast } from "sonner";
import { VerificationReviewPanel, StatusPill } from "@/components/cravio/VerificationPanel";
import { fetchDocs, summarize, normalizeStatus, type KycStatus } from "@/lib/verification-api";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/logistics/gigs/$gigId")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Gig Details" }] }),
  component: LogisticsGigDetails,
});

function LogisticsGigDetails() {
  const { gigId } = Route.useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gig, setGig] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "riders" | "capacity">("overview");
  const version = useTableVersion(["gigs", "gig_participants"]);

  const load = useCallback(async () => {
    setLoading(true);
    const [gRows, pRows] = await Promise.all([
      listTable("gigs", { id: `eq.${gigId}`, limit: 1 }),
      listTable("gig_participants", { gig_id: `eq.${gigId}`, limit: 200 }),
    ]);
    
    if (gRows[0]) setGig(gRows[0]);
    setParticipants(pRows);
    setLoading(false);
  }, [gigId]);

  useEffect(() => { void load(); }, [load, version]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!gig) return <div className="p-10 text-center font-bold">Gig not found.</div>;

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gig Details</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{gig.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={gig.status === "ACTIVE" ? "verified" : "pending"} />
        </div>
      </header>

      <div className="flex gap-2 border-b border-border/40">
        {(["overview", "riders", "capacity"] as const).map(t => (
          <button 
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold capitalize transition ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
              <h2 className="mb-4 font-display text-lg font-extrabold">Gig Performance</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MiniKpi label="Enrolled" value={participants.length} icon={Users} />
                <MiniKpi label="Target" value={gig.target_deliveries} icon={BarChart3} />
                <MiniKpi label="Payout" value={formatPrice(gig.reward_amount)} icon={Wallet} />
                <MiniKpi label="Completion" value={`${participants.filter(p => p.status === "COMPLETED").length}`} icon={CheckCircle2} />
              </div>
            </section>

            <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
              <h2 className="mb-4 font-display text-lg font-extrabold">Schedule</h2>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Start Time</p>
                  <p className="text-xl font-black">{new Date(gig.start_time).toLocaleTimeString()}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-30" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">End Time</p>
                  <p className="text-xl font-black">{new Date(gig.end_time).toLocaleTimeString()}</p>
                </div>
              </div>
            </section>
          </div>
          
          <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
            <h2 className="mb-4 font-display text-lg font-extrabold">Operational Context</h2>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-sm font-bold text-muted-foreground">Zone</span>
                <span className="text-sm font-black">{gig.zone_id || "Global"}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-sm font-bold text-muted-foreground">Created At</span>
                <span className="text-sm font-black">{new Date(gig.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "riders" && (
        <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Enrolled Riders</h2>
            <span className="text-xs font-bold text-muted-foreground">{participants.length} riders active</span>
          </div>
          {participants.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No riders have joined this gig yet.</p>
          ) : (
            <ul className="space-y-3">
              {participants.map(p => (
                <li key={p.id} className="flex items-center justify-between rounded-2xl bg-muted/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">R</div>
                    <div>
                      <p className="text-sm font-bold">Rider {p.rider_id.slice(0,8)}</p>
                      <p className="text-[10px] text-muted-foreground">Joined {new Date(p.joined_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Progress</p>
                      <p className="text-sm font-black">{p.completed_deliveries} / {gig.target_deliveries}</p>
                    </div>
                    <StatusPill status={p.status === "COMPLETED" ? "verified" : "pending"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "capacity" && (
        <section className="max-w-md space-y-4 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
          <h2 className="font-display text-lg font-extrabold">Adjust Capacity</h2>
          <p className="text-xs text-muted-foreground">Increase or decrease the maximum number of riders allowed to join this slot.</p>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Limit</label>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                defaultValue={50}
                className="w-full rounded-2xl bg-muted/40 px-4 py-3 text-sm font-black outline-none ring-1 ring-border/60 focus:ring-primary/40"
              />
              <button className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">Update</button>
            </div>
          </div>
          
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-[11px] font-medium leading-relaxed">
              Reducing capacity below the current enrollment count ({participants.length}) will not remove existing riders but will block new enrollments.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function MiniKpi({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
