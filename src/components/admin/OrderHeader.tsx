import { useMemo } from "react";
import { format } from "date-fns";
import { 
  RefreshCw, History, UserPlus, FileEdit, Map as MapIcon, 
  CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown 
} from "lucide-react";
import { OrderStatus, STATUS_LABEL, STATUS_TRANSITIONS, isValidTransition } from "@/lib/orders-api";
import { StatusBadge } from "@/components/cravio/AdminTable";
import { cn } from "@/lib/format";

type OrderHeaderProps = {
  order: any;
  onRefresh: () => void;
  onShowHistory: () => void;
  onAssignRider: () => void;
  onUpdateStatus: (status: OrderStatus) => void;
  onTrack: () => void;
};

export function OrderHeader({ 
  order, onRefresh, onShowHistory, onAssignRider, onUpdateStatus, onTrack 
}: OrderHeaderProps) {
  const status = (order.status || "PLACED") as OrderStatus;
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const availableTransitions = useMemo(() => {
    return STATUS_TRANSITIONS[status] || [];
  }, [status]);

  
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
          #{order.id.slice(-5).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Order #{order.id.slice(0, 8)}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <StatusBadge label={status} />
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.created_at), "MMM d, yyyy · HH:mm")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button 
          onClick={onRefresh}
          className="flex h-10 items-center gap-2 rounded-xl bg-muted px-4 text-xs font-bold hover:bg-muted/80 transition"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        <button 
          onClick={onShowHistory}
          className="flex h-10 items-center gap-2 rounded-xl bg-muted px-4 text-xs font-bold hover:bg-muted/80 transition"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </button>
        <button 
          onClick={onAssignRider}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-glow hover:opacity-90 transition"
        >
          <UserPlus className="h-4 w-4" />
          Assign Rider
        </button>
        <div className="relative">
          <button 
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex h-10 items-center gap-2 rounded-xl bg-card px-4 text-xs font-bold ring-1 ring-border/60 hover:bg-muted transition"
          >
            <FileEdit className="h-4 w-4" />
            Update Status
            <ChevronDown className={cn("h-3 w-3 transition-transform", showStatusMenu && "rotate-180")} />
          </button>
          
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-card p-2 shadow-glow ring-1 ring-border/60 z-50">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                Move status to...
              </p>
              {availableTransitions.length > 0 ? (
                availableTransitions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onUpdateStatus(s);
                      setShowStatusMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    {STATUS_LABEL[s]}
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-[10px] text-center text-muted-foreground italic">No further transitions</p>
              )}
            </div>
          )}
        </div>
        <button 
          onClick={onTrack}
          className="flex h-10 items-center gap-2 rounded-xl bg-card px-4 text-xs font-bold ring-1 ring-border/60 hover:bg-muted transition"
        >
          <MapIcon className="h-4 w-4" />
          Track
        </button>
      </div>
    </div>
  );
}
