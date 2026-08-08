import React from "react";
import { CheckCircle2, Circle, Clock, Package, Bike, Home, AlertCircle, XCircle } from "lucide-react";

const STAGES = [
  { id: "PLACED", label: "Order Placed", icon: Clock },
  { id: "ACCEPTED", label: "Accepted", icon: CheckCircle2 },
  { id: "RIDER_ASSIGNING", label: "Assigning Rider", icon: Circle },
  { id: "ACCEPTED", label: "Rider Assigned", icon: Bike }, // Status mapping is subtle
  { id: "AT_PICKUP", label: "At Restaurant", icon: Package },
  { id: "PICKED_UP", label: "Picked Up", icon: Bike },
  { id: "ON_THE_WAY", label: "Out for Delivery", icon: Bike },
  { id: "ARRIVED", label: "At Customer", icon: Home },
  { id: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
];

export function OrderShipmentTimeline({ status, isCancelled, isRejected }: { status: string; isCancelled?: boolean; isRejected?: boolean }) {
  if (isCancelled || status === "CANCELLED") return (
    <div className="flex items-center gap-2 text-destructive font-bold text-sm">
      <XCircle className="h-4 w-4" /> Order Cancelled
    </div>
  );

  if (isRejected || status === "REJECTED") return (
    <div className="flex items-center gap-2 text-destructive font-bold text-sm">
      <AlertCircle className="h-4 w-4" /> Order Rejected
    </div>
  );

  const currentIndex = STAGES.findIndex(s => s.id === status);

  return (
    <div className="flex items-center w-full overflow-x-auto py-2 scrollbar-none">
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        
        return (
          <React.Fragment key={stage.id + i}>
            <div className="flex flex-col items-center min-w-[80px] group">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                isPast ? "bg-primary border-primary text-primary-foreground" : 
                isCurrent ? "border-primary text-primary animate-pulse" : 
                "border-muted text-muted-foreground"
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`mt-1 text-[10px] font-bold text-center leading-tight ${
                isCurrent ? "text-primary" : "text-muted-foreground"
              }`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-[2px] w-8 shrink-0 mb-4 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
