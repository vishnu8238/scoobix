import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { deliveryRequests, type DeliveryRequest } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Check, X, MapPin, Package, Clock } from "lucide-react";
import { toast } from "sonner";
import { acceptDeliveryRequest, updateDeliveryStatus } from "@/lib/insforge";

function getDriverId(): string {
  if (typeof window === "undefined") return "guest";
  return window.localStorage.getItem("driverId") || "guest";
}

export const Route = createFileRoute("/rider/requests")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Requests" }] }),
  component: RiderRequests,
});

function RiderRequests() {
  const [list, setList] = useState<DeliveryRequest[]>(deliveryRequests);

  const decide = (id: string, accept: boolean) => {
    if (accept) void acceptDeliveryRequest(id, getDriverId());
    else void updateDeliveryStatus(id, "READY"); // leave available for other drivers
    setList((prev) => prev.filter((r) => r.id !== id));
    toast.success(accept ? `Accepted ${id} — head to pickup` : `Rejected ${id}`);
  };

  return (
    <div className="animate-fade-up px-5 pt-7">
      <header className="mb-5">
        <p className="eyebrow">Delivery Requests</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">New nearby trips</h1>
      </header>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-card p-10 text-center shadow-soft ring-1 ring-border/60">
          <p className="font-display text-lg font-bold">No requests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">We'll ping you when one comes in.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60">
              <div className="flex items-start gap-3 bg-gradient-to-br from-primary/10 to-transparent p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{r.id}</p>
                      <h3 className="font-display text-base font-extrabold">{r.restaurant}</h3>
                    </div>
                    <span className="font-display text-xl font-extrabold text-primary">{formatPrice(r.payout)}</span>
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.distanceKm} km</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.etaMins} min</span>
                    <span>· {r.itemsCount} items</span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2 text-xs">
                <div className="flex gap-2">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <p className="font-bold">Pickup · {r.restaurant}</p>
                    <p className="text-muted-foreground">{r.restaurantAddress}</p>
                  </div>
                </div>
                <div className="ml-1 h-3 w-px bg-border" />
                <div className="flex gap-2">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-foreground" />
                  <div>
                    <p className="font-bold">Drop-off · {r.customer}</p>
                    <p className="text-muted-foreground">{r.customerAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border/60 p-3">
                <button onClick={() => decide(r.id, false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-muted px-4 py-3 text-sm font-bold text-muted-foreground transition active:scale-95">
                  <X className="h-4 w-4" /> Reject
                </button>
                <button onClick={() => decide(r.id, true)} className="flex flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
                  <Check className="h-4 w-4" /> Accept delivery
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
