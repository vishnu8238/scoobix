import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { formatPrice } from "@/lib/format";
import { Check, X, MapPin, Package, Clock, Loader2, Calendar, Info, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useDriver } from "@/lib/driver-store";
import { listTable } from "@/lib/insforge-crud";
import { fetchGigs, enrollInGig, cancelGigEnrollment, type Gig } from "@/lib/gigs-api";
import { cn } from "@/lib/format";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/rider/requests")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Gigs & Scheduling" }] }),
  component: RiderRequestsPage,
});

type Tab = "available" | "booked" | "history";

function RiderRequestsPage() {
  const [tab, setTab] = useState<Tab>("available");
  const { driver, driverId, loading: driverLoading } = useDriver();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadGigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGigs();
      setGigs(data);
    } catch (e) {
      toast.error("Failed to load gigs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGigs();
  }, [loadGigs]);

  // For Part 2, we simulate enrollment tracking by checking against a local set or participant table
  // In a real app, fetchGigs would include enrollment status for the current driver
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (driverId) {
      listTable<any>("gig_participants", { rider_id: `eq.${driverId}` }).then(parts => {
        setEnrolledIds(new Set(parts.map(p => p.gig_id)));
      });
    }
  }, [driverId, busy]);

  const filtered = useMemo(() => {
    const now = new Date().toISOString();
    if (tab === "available") {
      return gigs.filter(g => !enrolledIds.has(g.id) && g.start_time > now && g.status !== "CANCELLED");
    }
    if (tab === "booked") {
      return gigs.filter(g => enrolledIds.has(g.id) && g.end_time > now);
    }
    return gigs.filter(g => g.end_time <= now || (enrolledIds.has(g.id) && g.status === "COMPLETED"));
  }, [gigs, tab, enrolledIds]);

  const handleAction = async (gigId: string, action: 'enroll' | 'cancel') => {
    if (!driverId) return;
    setBusy(true);
    try {
      if (action === 'enroll') {
        await enrollInGig(gigId, driverId);
        toast.success("Gig booked successfully!");
      } else {
        const confirmed = window.confirm("Are you sure you want to cancel this booking?");
        if (!confirmed) return;
        await cancelGigEnrollment(gigId, driverId);
        toast.info("Booking cancelled");
      }
      void loadGigs();
    } catch (e) {
      toast.error("Operation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Gigs" subtitle="Schedule your delivery shifts" />

      <div className="mx-4 mt-6 flex gap-2 rounded-full bg-muted/50 p-1">
        {(["available", "booked", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2.5 text-[10px] font-black uppercase tracking-widest transition",
              tab === t ? "bg-card text-primary shadow-soft ring-1 ring-border/60" : "text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 px-4 space-y-4">
        {loading || driverLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em]">Syncing slots...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState 
            icon={<Calendar className="h-8 w-8 text-muted-foreground/30" />}
            title={`No ${tab} gigs`}
            description={tab === "available" ? "Check back later for new shifts." : "Your scheduled gigs will appear here."}
          />
        ) : (
          filtered.map(gig => (
            <GigCard 
              key={gig.id} 
              gig={gig} 
              isBooked={enrolledIds.has(gig.id)}
              onAction={(action) => handleAction(gig.id, action)}
              busy={busy}
            />
          ))
        )}
      </div>

      {tab === "available" && !loading && filtered.length > 0 && (
        <div className="mx-4 mt-8 rounded-3xl bg-primary/5 p-5 ring-1 ring-primary/10">
           <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Booking Rules</p>
                 <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                   Gigs can be cancelled up to 2 hours before start time without penalty. 
                   Late cancellations or no-shows may affect your rider rating.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function GigCard({ gig, isBooked, onAction, busy }: { gig: Gig; isBooked: boolean; onAction: (a: 'enroll' | 'cancel') => void; busy: boolean }) {
  const start = new Date(gig.start_time);
  const end = new Date(gig.end_time);
  const dateStr = start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  
  const now = new Date();
  const isActive = start <= now && end >= now;
  const isCompleted = end < now;

  return (
    <div className={cn(
      "overflow-hidden rounded-[2rem] bg-card shadow-soft ring-1 transition-all",
      isBooked ? "ring-primary/20" : "ring-border/60"
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {dateStr}
              </span>
              {isActive && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-600">
                  <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  Active Now
                </span>
              )}
            </div>
            <h3 className="mt-1 font-display text-lg font-extrabold tracking-tight">{gig.title}</h3>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-black text-primary">{formatPrice(gig.reward_amount)}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Est. Reward</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-bold">{timeStr}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-bold">{gig.zone_id ? "Vadodara Central" : "Any Zone"}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                <div className="h-full w-full bg-primary/10 text-[8px] font-bold flex items-center justify-center">R</div>
              </div>
            ))}
            <div className="h-6 px-2 rounded-full border-2 border-background bg-muted text-[8px] font-bold flex items-center justify-center">
              +12
            </div>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {gig.capacity ? `${Math.round(Math.random() * gig.capacity)}/${gig.capacity} Slots` : "Open Slots"}
          </span>
        </div>
      </div>

      <div className="border-t border-border/40 p-3 bg-muted/20">
        {isCompleted ? (
          <div className="flex w-full items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Gig Completed
          </div>
        ) : isBooked ? (
          <button 
            disabled={busy}
            onClick={() => onAction('cancel')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-xs font-black uppercase tracking-widest text-muted-foreground transition active:scale-95"
          >
            Cancel Booking
          </button>
        ) : (
          <button 
            disabled={busy}
            onClick={() => onAction('enroll')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow transition active:scale-95"
          >
            Book Slot
          </button>
        )}
      </div>
    </div>
  );
}
