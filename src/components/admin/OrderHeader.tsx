import { useMemo } from "react";
import { format } from "date-fns";
import { 
  RefreshCw, History, UserPlus, FileEdit, Map as MapIcon, 
  CheckCircle2, Clock, AlertCircle, XCircle 
} from "lucide-react";
import { StatusBadge } from "@/components/cravio/AdminTable";
import { cn } from "@/lib/format";

type OrderHeaderProps = {
  order: any;
  onRefresh: () => void;
  onShowHistory: () => void;
  onAssignRider: () => void;
  onUpdateStatus: () => void;
  onTrack: () => void;
};

export function OrderHeader({ 
  order, onRefresh, onShowHistory, onAssignRider, onUpdateStatus, onTrack 
}: OrderHeaderProps) {
  const status = order.status || "PLACED";
  
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
        <button 
          onClick={onUpdateStatus}
          className="flex h-10 items-center gap-2 rounded-xl bg-card px-4 text-xs font-bold ring-1 ring-border/60 hover:bg-muted transition"
        >
          <FileEdit className="h-4 w-4" />
          Update Status
        </button>
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
