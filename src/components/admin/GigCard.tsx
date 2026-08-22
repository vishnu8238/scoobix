import { type Gig } from "@/lib/gigs-api";
import { format, parseISO, differenceInHours } from "date-fns";
import { Clock, MapPin, Users, ChevronRight, MoreHorizontal, Edit2, XCircle, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GigCardProps {
  gig: Gig;
  onEdit?: (gig: Gig) => void;
  onDelete?: (gig: Gig) => void;
  enrollmentCount?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  citiesMap?: Record<string, string>;
  zonesMap?: Record<string, string>;
}

export function GigCard({ 
  gig, 
  onEdit, 
  onDelete,
  enrollmentCount = 0, 
  selected = false,
  onSelect,
  citiesMap = {},
  zonesMap = {}
}: GigCardProps) {

  const startStr = gig.start_time || new Date().toISOString();
  const endStr = gig.end_time || new Date().toISOString();
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  const duration = differenceInHours(end, start);
  const maxEnrollment = gig.capacity || 50;
  const progress = (enrollmentCount / maxEnrollment) * 100;

  return (
    <div className="group relative flex flex-col rounded-[2rem] bg-card p-6 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-primary/20">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input 
              type="checkbox" 
              checked={selected}
              onChange={(e) => onSelect(gig.id, e.target.checked)}
              className="h-4 w-4 rounded-md border-border/60 bg-muted/50 accent-primary focus:ring-primary/40 transition-all cursor-pointer"
            />
          )}
          <div className="flex flex-col gap-2">
            <span className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm",
              gig.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
              gig.status === "SCHEDULED" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
              gig.status === "CANCELLED" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" :
              "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
            )}>
              {gig.status === "ACTIVE" ? "Open" : gig.status.toLowerCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground/60">#{gig.id.slice(0, 5).toUpperCase()}</span>
          {onDelete && (
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 onDelete(gig);
               }}
               className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-50 transition-colors"
               title={enrollmentCount > 0 ? "Cancel Gig" : "Delete Gig"}
             >
               {enrollmentCount > 0 ? <XCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
             </button>
          )}
        </div>
      </div>


      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 dark:bg-primary/20">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight">
              {format(start, "HH:mm")} - {format(end, "HH:mm")}
            </h3>
            <p className="text-[10px] font-semibold text-muted-foreground">Duration: {duration}h</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900/50">
            <MapPin className="h-3 w-3" />
            City: {gig.city_id ? (citiesMap[gig.city_id] || "Unknown City") : "Unassigned"}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-600 ring-1 ring-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:ring-purple-900/50">
            <MapPin className="h-3 w-3" />
            Zone: {gig.zone_id ? (zonesMap[gig.zone_id] || "Unknown Zone") : "Unassigned"}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 border-y border-border/40 py-4">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground/80">Payout</p>
          <p className="text-2xl font-black text-emerald-600">₹{gig.reward_amount}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground/80 text-right">Enrollment</p>
          <p className="text-sm font-black">{enrollmentCount} / {maxEnrollment}</p>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-muted-foreground/80">Gig Completion Status</span>
          <span className="text-primary">{gig.metadata?.completion_pct ? `${gig.metadata.completion_pct}%` : "Unavailable"}</span>
        </div>
        <Progress value={gig.metadata?.completion_pct || 0} className="h-1.5 bg-muted" />
      </div>


      <div className="mt-auto space-y-4">
        <div className="rounded-xl bg-muted/50 p-3 ring-1 ring-border/50">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Slot ID</p>
          <p className="font-mono text-[10px] font-bold tracking-tighter">
            {format(start, "HH_mm")}_{format(end, "HH_mm")}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => onEdit?.(gig)}
            className="flex-1 rounded-2xl border border-primary/20 bg-primary/5 py-3 text-xs font-black text-primary transition-all hover:bg-primary hover:text-white active:scale-[0.98]"
          >
            Edit Details
          </button>
          {onDelete && (
            <button 
              onClick={() => onDelete(gig)}
              className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-xs font-black text-rose-600 transition-all hover:bg-rose-600 hover:text-white active:scale-[0.98]"
            >
              {enrollmentCount > 0 ? "Cancel Gig" : "Delete Gig"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GigStats({ 
  totalGigs = 0, 
  needed = 0, 
  enrolled = 0, 
  fullyBooked = 0 
}) {
  const stats = [
    { label: "Total Gigs", value: totalGigs, color: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
    { label: "Needed", value: needed, color: "bg-orange-50 text-orange-600 ring-orange-200" },
    { label: "Enrolled", value: enrolled, color: "bg-lime-50 text-lime-600 ring-lime-200" },
    { label: "Fully Booked", value: fullyBooked, color: "bg-blue-50 text-blue-600 ring-blue-200" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map((s) => (
        <div 
          key={s.label} 
          className={cn(
            "flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black ring-1",
            s.color
          )}
        >
          <span className="opacity-70">{s.label}:</span>
          <span>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
