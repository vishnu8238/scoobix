import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bike, Check, MapPin, X } from "lucide-react";
import { useDelivery } from "@/lib/delivery-store";
import { currency } from "@/lib/format";
import { toast } from "sonner";

/**
 * Global pop-up that surfaces incoming delivery requests to the current rider.
 * Mounted on /rider layout. Times out per Admin's accept timer setting,
 * then automatically rolls to the next nearest driver in the queue.
 */
export function DriverAssignDialog() {
  const { activeRequest, settings, acceptRequest, rejectRequest } = useDelivery();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeRequest) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [activeRequest]);

  if (!activeRequest) return null;

  const remainingMs = Math.max(0, activeRequest.expiresAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = Math.min(100, (remainingMs / (settings.acceptTimerSec * 1000)) * 100);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) rejectRequest(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden">
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
            <Bike className="h-3.5 w-3.5" /> New delivery request
          </div>
          <DialogTitle className="mt-1 text-lg font-extrabold">{activeRequest.restaurantName}</DialogTitle>
          <DialogDescription className="text-primary-foreground/80">
            Auto-assigning to next driver in {remainingSec}s
          </DialogDescription>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3 w-3" /> Distance
              </div>
              <p className="mt-1 font-display text-lg font-extrabold">{activeRequest.distanceKm.toFixed(1)} km</p>
            </div>
            <div className="rounded-2xl bg-primary-soft p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Earnings</div>
              <p className="mt-1 font-display text-lg font-extrabold text-primary">{currency(activeRequest.earnings)}</p>
            </div>
          </div>

          <div>
            <Progress value={pct} />
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{remainingSec}s to respond</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={() => { rejectRequest(); toast("Request passed to next driver"); }}
              variant="outline"
              className="h-12 rounded-2xl text-sm font-bold"
            >
              <X className="mr-1.5 h-4 w-4" /> Reject
            </Button>
            <Button
              onClick={() => { acceptRequest(); toast.success("Delivery accepted"); }}
              className="h-12 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-glow"
            >
              <Check className="mr-1.5 h-4 w-4" /> Accept
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
