import { format } from "date-fns";
import { 
  CheckCircle2, Clock, AlertCircle, MapPin, 
  Truck, Package, ShoppingBag, Info 
} from "lucide-react";
import { cn } from "@/lib/format";

type TimelineEvent = {
  status: string;
  timestamp: string | number;
  message?: string;
  admin?: string;
};

export function OrderLifecycleTimeline({ history }: { history: any[] }) {
  if (!history || history.length === 0) return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h3 className="font-display font-extrabold flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        Order Journey
      </h3>
      <p className="text-xs text-muted-foreground text-center py-4 italic">No history recorded for this order.</p>
    </div>
  );

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h3 className="font-display font-extrabold flex items-center gap-2 mb-6">
        <Clock className="h-5 w-5 text-primary" />
        Order Journey
      </h3>

      <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border/60">
        {history.map((event, idx) => (
          <div key={idx} className="relative pl-8">
            <div className={cn(
              "absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-card z-10",
              idx === 0 ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"
            )}>
              {idx === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-bold uppercase tracking-wide">{event.action || event.status}</p>
                <time className="text-[10px] text-muted-foreground font-medium">
                  {format(new Date(event.created_at || event.timestamp), "MMM d, HH:mm:ss")}
                </time>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {event.message || `Status updated to ${event.status}`}
              </p>
              {event.actor_email && (
                <div className="mt-1 flex items-center gap-1.5">
                   <div className="h-1 w-1 rounded-full bg-primary/40" />
                   <p className="text-[9px] font-bold text-primary/70 uppercase">Admin: {event.actor_email}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderDeliveryProof({ proofs }: { proofs: any }) {
  if (!proofs.pickup && !proofs.delivery) return null;

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h3 className="font-display font-extrabold flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        Delivery Proofs
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {proofs.pickup && (
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Pickup Image</p>
            <img src={proofs.pickup} className="rounded-2xl w-full h-32 object-cover bg-muted ring-1 ring-border/40" alt="Pickup Proof" />
          </div>
        )}
        {proofs.delivery && (
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Delivery Image</p>
            <img src={proofs.delivery} className="rounded-2xl w-full h-32 object-cover bg-muted ring-1 ring-border/40" alt="Delivery Proof" />
          </div>
        )}
      </div>
    </div>
  );
}
