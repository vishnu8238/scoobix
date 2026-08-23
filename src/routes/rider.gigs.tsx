import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useTableVersion } from "@/lib/realtime-hooks";
import { formatPrice } from "@/lib/format";
import { 
  Check, X, MapPin, Package, Clock, Loader2, Calendar, 
  Info, ChevronRight, CheckCircle2, AlertCircle, ChevronLeft 
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { listTable } from "@/lib/insforge-crud";
import { fetchGigs, enrollInGig, cancelGigEnrollment, type Gig } from "@/lib/gigs-api";
import { cn } from "@/lib/format";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";
import { PortalErrorBoundary } from "@/components/cravio/PortalErrorBoundary";

export const Route = createFileRoute("/rider/gigs")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Gigs & Scheduling" }] }),
  component: RiderGigsPage,
});

type Tab = "available" | "booked" | "history";

function RiderGigsPage() {
  const [tab, setTab] = useState<Tab>("available");
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const version = useTableVersion(["rider_gig_enrollments", "gigs"]);
  
  // Authoritative identity for enrollment: users.id
  const riderEnrollmentIdentityId = user?.id ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Authoritative parallel fetch
      const [gigsData, participantsData] = await Promise.all([
        fetchGigs(),
        riderEnrollmentIdentityId 
          ? listTable<any>("rider_gig_enrollments", { rider_id: `eq.${riderEnrollmentIdentityId}` }, { fresh: true, ttl: 0 })
          : Promise.resolve([])
      ]);
      
      setGigs(Array.isArray(gigsData) ? gigsData : []);
      setEnrolledIds(new Set((participantsData || []).map(p => p.gig_id)));
    } catch (e: any) {
      console.error("[RIDER_GIGS] Load error:", e);
      setError(e.message === "TIMEOUT" 
        ? "Syncing is taking longer than expected. Please check your connection." 
        : "Failed to sync slots. Tap to retry."
      );
    } finally {
      setLoading(false);
    }
  }, [riderEnrollmentIdentityId]);

  useEffect(() => {
    void loadData();
  }, [loadData, version]);

  const handleAction = async (gigId: string, action: 'enroll' | 'cancel') => {
    if (!riderEnrollmentIdentityId) {
      toast.error("Auth session required");
      return;
    }
    setBusy(true);
    try {
      if (action === 'enroll') {
        const res = await enrollInGig(gigId, riderEnrollmentIdentityId);
        if (res) {
          toast.success("Gig booked successfully!");
          setEnrolledIds(prev => new Set([...prev, gigId]));
        }
      } else {
        const confirmed = window.confirm("Are you sure you want to cancel this booking?");
        if (!confirmed) return;
        await cancelGigEnrollment(gigId, riderEnrollmentIdentityId);
        toast.info("Booking cancelled");
        setEnrolledIds(prev => {
          const next = new Set(prev);
          next.delete(gigId);
          return next;
        });
      }
      // Re-fetch to ensure authoritative state
      void loadData();
    } catch (e) {
      toast.error("Operation failed. Gig may be full or unavailable.");
    } finally {
      setBusy(false);
    }
  };

  // Generate dates for horizontal picker
  const dates = useMemo(() => {
    const d = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const next = new Date(now);
      next.setDate(now.getDate() + i);
      d.push(next);
    }
    return d;
  }, []);

  const filteredGigs = useMemo(() => {
    const selDateStr = selectedDate.toISOString().split('T')[0];
    
    return gigs.filter(g => {
      const startTime = g.start_time || new Date().toISOString();
      const endTime = g.end_time || new Date().toISOString();
      const gigDateStr = new Date(startTime).toISOString().split('T')[0];
      const matchesDate = gigDateStr === selDateStr;
      const isEnrolled = enrolledIds.has(g.id);
      const isHistory = new Date(endTime) < new Date();

      if (tab === "available") return matchesDate && !isEnrolled && !isHistory;
      if (tab === "booked") return isEnrolled && !isHistory;
      return isHistory;
    });
  }, [gigs, enrolledIds, tab, selectedDate]);

  return (
    <PortalErrorBoundary portal="Rider Gigs">
      <div className="w-full min-h-svh pb-8">
      <PageHeader title="Gigs" subtitle="Schedule your delivery shifts" />

      {/* Tab Switcher */}
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

      {/* Date Picker (only for available) */}
      {tab === "available" && (
        <div className="mt-6 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
          {dates.map((d, i) => {
            const isSelected = d.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex flex-col items-center min-w-[56px] py-3 rounded-2xl transition-all duration-300",
                  isSelected ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted/50 text-muted-foreground"
                )}
              >
                <span className="text-[10px] font-bold uppercase opacity-60">
                  {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="text-sm font-black mt-0.5">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 px-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em]">Syncing slots...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8" />
            </div>
            <p className="text-sm font-bold text-foreground">{error}</p>
            <button 
              onClick={() => void loadData()}
              className="mt-6 rounded-2xl bg-primary px-8 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow"
            >
              Retry Sync
            </button>
          </div>
        ) : filteredGigs.length === 0 ? (
          <EmptyState 
            icon={<Calendar className="h-8 w-8 text-muted-foreground/30" />}
            title={`No ${tab} gigs`}
            description={
              tab === "available" 
                ? `No shifts found for ${selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.` 
                : tab === "booked" 
                ? "Your scheduled gigs will appear here." 
                : "Your past shift history is empty."
            }
          />
        ) : (
          filteredGigs.map(gig => (
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

      {tab === "available" && !loading && filteredGigs.length > 0 && (
        <div className="mx-4 mt-8 rounded-3xl bg-primary/5 p-5 ring-1 ring-primary/10">
           <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Booking Rules</p>
                 <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                   Gigs can be cancelled up to 2 hours before start time without penalty. 
                   Late cancellations or no-shows may affect your rating.
                 </p>
              </div>
           </div>
        </div>
      )}
      </div>
    </PortalErrorBoundary>
  );
}

function GigCard({ gig, isBooked, onAction, busy }: { gig: Gig; isBooked: boolean; onAction: (a: 'enroll' | 'cancel') => void; busy: boolean }) {
  const [participantCount, setParticipantCount] = useState<number>(0);
  const version = useTableVersion(["rider_gig_enrollments"]);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await listTable("rider_gig_enrollments", { gig_id: `eq.${gig.id}` });
        setParticipantCount(rows.length);
      } catch (e) {}
    };
    void load();
  }, [gig.id, version]);

  const startStr = gig.start_time || new Date().toISOString();
  const endStr = gig.end_time || new Date().toISOString();
  const start = new Date(startStr);
  const end = new Date(endStr);
  const dateStr = start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = `${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  
  const now = new Date();
  const isActive = start <= now && end >= now;
  const isCompleted = end < now;

  return (
    <div className={cn(
      "overflow-hidden rounded-[2.5rem] bg-card shadow-soft ring-1 transition-all",
      isBooked ? "ring-primary/40 shadow-glow" : "ring-border/60 hover:ring-primary/20"
    )}>
      <div className="p-6">
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
            <h3 className="mt-1 font-display text-xl font-extrabold tracking-tight">{gig.title}</h3>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-black text-primary">{formatPrice(gig.reward_amount || 0)}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Est. Reward</p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
               <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">{timeStr}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
               <MapPin className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">{gig.zone_id ? "Vadodara Central" : "Any Zone"}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden shadow-sm">
                <div className="h-full w-full bg-primary/10 text-[8px] font-black flex items-center justify-center">R</div>
              </div>
            ))}
            <div className="h-7 px-2 rounded-full border-2 border-background bg-muted text-[8px] font-black flex items-center justify-center shadow-sm">
              +12
            </div>
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            {gig.capacity ? `${participantCount}/${gig.capacity} Slots Booked` : `${participantCount} Enrolled`}
          </span>
        </div>
      </div>

      <div className="border-t border-border/40 p-4 bg-muted/20">
        {isCompleted ? (
          <div className="flex w-full items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Gig Completed
          </div>
        ) : isBooked ? (
          <button 
            disabled={busy}
            onClick={() => onAction('cancel')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-4 text-xs font-black uppercase tracking-widest text-muted-foreground transition active:scale-[0.98] hover:bg-muted/40"
          >
            Cancel Booking
          </button>
        ) : (
          <button 
            disabled={busy}
            onClick={() => onAction('enroll')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow transition active:scale-[0.98]"
          >
            <Calendar className="h-4 w-4" /> Book Slot
          </button>
        )}
      </div>
    </div>
  );
}
