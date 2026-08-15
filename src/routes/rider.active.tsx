import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { 
  Phone, Navigation, MapPin, Store, User, CheckCircle2, 
  ShieldCheck, Wallet, Star, Loader2, PackageOpen, Battery, 
  Zap, Bell, Volume2, Info, XCircle, ChevronRight,
  Camera, FileCheck, CreditCard, AlertTriangle, MessageSquare,
  Bike
} from "lucide-react";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { toast } from "sonner";
import { onTableChange } from "@/lib/realtime-bus";
import { acceptOrderOffer, rejectOrderOffer, cancelAssignment } from "@/lib/logistics-engine.functions";
import { pingDriverLocation } from "@/lib/insforge";
import { useCms } from "@/lib/cms-store";
import { useDriver } from "@/lib/driver-store";
import { listTable } from "@/lib/insforge-crud";
import { patchOrder, patchPaymentByOrder, type OrderRow } from "@/lib/orders-api";
import { startNavigation } from "@/lib/navigation";
import { finalizeOrder } from "@/lib/order-completion";
import { updateOrderState } from "@/lib/rider-api";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/rider/active")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Active Delivery" }] }),
  component: RiderActive,
});

type DetailedStatus = 
  | "ASSIGNED"
  | "ACCEPTED" 
  | "HEADING_TO_RESTAURANT"
  | "ARRIVED_AT_RESTAURANT"
  | "PICKED_UP"
  | "HEADING_TO_CUSTOMER"
  | "ARRIVED_AT_CUSTOMER"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "DISPUTED";

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "New Trip Assigned",
  ACCEPTED: "Heading to Restaurant",
  HEADING_TO_RESTAURANT: "Heading to Restaurant",
  ARRIVED_AT_RESTAURANT: "At Restaurant",
  PICKED_UP: "Heading to Customer",
  HEADING_TO_CUSTOMER: "Heading to Customer",
  ARRIVED_AT_CUSTOMER: "At Customer",
  DELIVERED: "Delivered",
  FAILED: "Delivery Failed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

const ACTIVE_STATUSES = [
  "ASSIGNED", "ACCEPTED", "READY", "PICKED_UP", "ON_THE_WAY", 
  "ARRIVED", "AT_PICKUP", "HEADING_TO_RESTAURANT", "ARRIVED_AT_RESTAURANT",
  "HEADING_TO_CUSTOMER", "ARRIVED_AT_CUSTOMER"
];

function RiderActive() {
  const navigate = useNavigate();
  const cms = useCms();
  const settings = cms?.settings;
  const { driver, driverId, loading: driverLoading, update: updateDriver } = useDriver();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [activeOffer, setActiveOffer] = useState<any | null>(null);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failReason, setFailReason] = useState("");

  // --- Sync with backend ---
  const load = useCallback(async () => {
    // Always clear loading if driver resolution fails or completes
    if (driverLoading) return;
    
    if (!driverId) { 
      setOrder(null); 
      setLoading(false); 
      return; 
    }
    
    setLoading(true);
    try {
      console.log("[RIDER_ACTIVE] Fetching active order for driver:", driverId);
      const rows = await listTable<OrderRow>("orders", {
        driver_id: `eq.${driverId}`,
        order: "created_at.desc",
        limit: 10,
      }, { fresh: true, ttl: 0 });
      
      const active = (rows || []).find((r) => ACTIVE_STATUSES.includes(String(r.status ?? "").toUpperCase())) ?? null;
      setOrder(active);

      if (active) {
        // Parallel fetch for associated data
        const [rs, us] = await Promise.all([
          active.restaurant_id 
            ? listTable<any>("restaurants", { id: `eq.${active.restaurant_id}`, limit: 1 }).catch(() => [])
            : Promise.resolve([]),
          active.customer_id
            ? listTable<any>("users", { id: `eq.${active.customer_id}`, limit: 1 }).catch(() => [])
            : Promise.resolve([])
        ]);
        
        setRestaurant(rs[0] ?? null);
        setCustomer(us[0] ?? null);
      } else {
        setRestaurant(null);
        setCustomer(null);
      }
    } catch (err: any) {
      console.error("[RIDER_ACTIVE] Sync error:", err);
      toast.error("Network error while syncing delivery state.");
    } finally {
      setLoading(false);
    }
  }, [driverId, driverLoading]);

  useEffect(() => { void load(); }, [load]);

  // --- Realtime Subscription ---
  useEffect(() => {
    if (!driverId) return;
    return onTableChange("orders", (payload) => {
      if (payload.row?.driver_id === driverId) {
        void load();
      }
    });
  }, [driverId, load]);

  const handleStatusChange = async (newStatus: string, metadata?: any) => {
    if (!order?.id || !driverId || busy) return;
    setBusy(true);
    try {
      await updateOrderState(String(order.id), driverId, newStatus, metadata);
      toast.success(`Status updated: ${STATUS_LABELS[newStatus] || newStatus}`);
      await load();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!activeOffer || !driverId || busy) return;
    setBusy(true);
    try {
      const res = await acceptOrderOffer({ 
        data: {
          orderId: activeOffer.order_id, 
          riderId: driverId, 
          offerId: activeOffer.id 
        }
      });
      if (res.success) {
        toast.success("Order accepted!");
        setActiveOffer(null);
        await load();
      } else {
        toast.error(res.error || "Failed to accept order");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const handleDeliveryComplete = async () => {
    if (!order?.id || !driverId) return;
    // OTP verification if required
    if (order.otp_required && otp !== order.otp) {
      toast.error("Invalid delivery PIN");
      return;
    }
    
    await handleStatusChange("DELIVERED", { 
      delivered_at: new Date().toISOString(),
      payment_status: "PAID"
    });
    
    if (order.id) {
       await patchPaymentByOrder(String(order.id), { status: "PAID" });
       await finalizeOrder(String(order.id));
    }
    
    navigate({ to: "/rider/history" });
  };

  const currentStatus = String(order?.status ?? "").toUpperCase();

  if (driverLoading || loading) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center py-20 opacity-40">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em]">Syncing delivery state...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[80svh] flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-primary/5 text-primary shadow-soft">
          <PackageOpen className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">No active delivery</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Accept a new delivery request from the feed or booked gigs to start your journey.
        </p>
        <button 
          onClick={() => navigate({ to: "/rider" })}
          className="mt-8 rounded-2xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition-all"
        >
          View Requests
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px] pb-32 animate-fade-up">
      {/* Dynamic Header */}
      <div className={cn(
        "relative overflow-hidden p-8 text-white transition-colors duration-500",
        currentStatus === "ARRIVED_AT_RESTAURANT" || currentStatus === "AT_PICKUP" ? "bg-amber-600" :
        currentStatus === "PICKED_UP" || currentStatus === "ON_THE_WAY" ? "bg-primary" :
        currentStatus === "ARRIVED_AT_CUSTOMER" ? "bg-emerald-600" : "bg-zinc-900"
      )}>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            Order Status
          </p>
          <h1 className="mt-2 font-display text-3xl font-black italic tracking-tight">
            {STATUS_LABELS[currentStatus] || currentStatus}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest">
              #{String(order.id).slice(-6).toUpperCase()}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest">
              {order.payment_method === 'cash' ? 'COD' : 'PREPAID'}
            </span>
          </div>
        </div>
        
        <div className="absolute -right-8 -top-8 opacity-10">
          <Bike className="h-40 w-40" />
        </div>
      </div>

      <div className="-mt-6 space-y-4 px-5">
        {/* Map Preview */}
        <section className="h-64 overflow-hidden rounded-[2rem] bg-muted shadow-card ring-1 ring-border/60">
           <GoogleMap 
             className="h-full w-full"
             center={order.pickup_latitude && order.pickup_longitude ? { lat: Number(order.pickup_latitude), lng: Number(order.pickup_longitude) } : undefined}
             zoom={13}
             markers={[
               ...(order.pickup_latitude && order.pickup_longitude ? [{
                 id: "pickup",
                 lat: Number(order.pickup_latitude),
                 lng: Number(order.pickup_longitude),
                 kind: "pickup" as const,
                 label: "Pickup"
               }] : []),
               ...(order.delivery_latitude && order.delivery_longitude ? [{
                 id: "dropoff",
                 lat: Number(order.delivery_latitude),
                 lng: Number(order.delivery_longitude),
                 kind: "drop" as const,
                 label: "Drop-off"
               }] : [])
             ]}
           />
        </section>

        {/* Action Center */}
        <section className="rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border/60">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                 </div>
                 <span className="font-display text-lg font-extrabold">Workflow</span>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Step {
                currentStatus === "ASSIGNED" ? 1 :
                currentStatus === "ACCEPTED" || currentStatus === "HEADING_TO_RESTAURANT" ? 2 :
                currentStatus === "ARRIVED_AT_RESTAURANT" || currentStatus === "AT_PICKUP" ? 3 :
                currentStatus === "PICKED_UP" || currentStatus === "HEADING_TO_CUSTOMER" ? 4 : 5
              }/5</span>
           </div>

           <div className="space-y-3">
              {currentStatus === "ASSIGNED" && (
                <button onClick={() => handleStatusChange("HEADING_TO_RESTAURANT")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95">
                   Start Trip
                </button>
              )}
              
              {(currentStatus === "ACCEPTED" || currentStatus === "HEADING_TO_RESTAURANT") && (
                <>
                  <button onClick={() => handleStatusChange("ARRIVED_AT_RESTAURANT")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95">
                    I've Arrived at Restaurant
                  </button>
                  <button onClick={() => startNavigation({ address: restaurant?.address || order.pickup_address })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-xs font-bold uppercase tracking-widest text-foreground transition active:scale-95">
                    <Navigation className="h-4 w-4" /> Navigate to Pickup
                  </button>
                </>
              )}

              {(currentStatus === "ARRIVED_AT_RESTAURANT" || currentStatus === "AT_PICKUP" || currentStatus === "READY") && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Order Verification</p>
                    <p className="mt-1 text-xs text-amber-800">Check items against the list below and ask for PIN if required.</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      value={otp} 
                      onChange={e => setOtp(e.target.value.slice(0, 4))}
                      placeholder="Pickup PIN" 
                      className="flex-1 rounded-2xl bg-muted px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button onClick={() => handleStatusChange("PICKED_UP")} className="flex-[2] rounded-2xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow">
                      Confirm Pickup
                    </button>
                  </div>
                </div>
              )}

              {(currentStatus === "PICKED_UP" || currentStatus === "HEADING_TO_CUSTOMER" || currentStatus === "ON_THE_WAY") && (
                <>
                  <button onClick={() => handleStatusChange("ARRIVED_AT_CUSTOMER")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95">
                    I've Arrived at Customer
                  </button>
                  <button onClick={() => startNavigation({ address: (order.delivery_address as string) || "" })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-xs font-bold uppercase tracking-widest text-foreground transition active:scale-95">
                    <Navigation className="h-4 w-4" /> Navigate to Customer
                  </button>
                </>
              )}

              {(currentStatus === "ARRIVED_AT_CUSTOMER" || currentStatus === "ARRIVED") && (
                <div className="space-y-4">
                  {order.payment_method === 'cash' && (
                    <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                       <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Collect Cash</p>
                       <div className="mt-2 flex items-baseline justify-between">
                          <span className="font-display text-2xl font-black text-emerald-800">{formatPrice(Number(order.total_price) || 0)}</span>
                          <CreditCard className="h-5 w-5 text-emerald-600" />
                       </div>
                    </div>
                  )}
                  <button onClick={handleDeliveryComplete} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95">
                    Complete Delivery
                  </button>
                </div>
              )}
           </div>
        </section>

        {/* Order Details */}
        <section className="rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border/60">
           <div className="flex items-center gap-3 mb-6">
              <Store className="h-5 w-5 text-primary" />
              <div className="flex-1">
                 <h3 className="font-display text-lg font-extrabold truncate">{restaurant?.name || "Restaurant"}</h3>
                 <p className="text-xs text-muted-foreground truncate">{restaurant?.address || order.pickup_address}</p>
              </div>
              <a href={`tel:${restaurant?.phone || '108'}`} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-primary">
                 <Phone className="h-4 w-4" />
              </a>
           </div>

           <div className="border-t border-border/40 my-6 pt-6">
              <div className="flex items-center gap-3">
                 <User className="h-5 w-5 text-zinc-900" />
                 <div className="flex-1">
                    <h3 className="font-display text-lg font-extrabold">{customer?.name || "Customer"}</h3>
                    <p className="text-xs text-muted-foreground truncate">{(order.delivery_address as React.ReactNode) || ""}</p>
                 </div>
                 <a href={`tel:${customer?.phone || '100'}`} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-zinc-900">
                    <Phone className="h-4 w-4" />
                 </a>
              </div>
           </div>

           <div className="rounded-2xl bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order Items</span>
                 <span className="text-[10px] font-black text-primary uppercase tracking-widest">₹{(order.total_price as React.ReactNode) || 0} Total</span>
              </div>
              <ul className="space-y-2">
                 {/* Logic to parse items from order.items */}
                 <li className="flex items-center justify-between text-xs font-bold">
                    <span>Standard Delivery Order</span>
                    <span className="text-muted-foreground">x1</span>
                 </li>
              </ul>
           </div>
        </section>

        {/* Critical Actions */}
        <div className="grid grid-cols-2 gap-3">
           <button onClick={() => setShowFailedModal(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-50 p-4 text-[10px] font-black uppercase tracking-widest text-rose-600 ring-1 ring-rose-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Report Issue
           </button>
           <button onClick={() => navigate({ to: "/rider/support" })} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 p-4 text-[10px] font-black uppercase tracking-widest text-white">
              <MessageSquare className="h-3.5 w-3.5" />
              Support
           </button>
        </div>
      </div>
    </div>
  );
}
