import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { 
  Phone, Navigation, MapPin, Store, User, CheckCircle2, 
  ShieldCheck, Wallet, Star, Loader2, PackageOpen, Battery, 
  Zap, Bell, Volume2, Info, XCircle, ChevronRight,
  Camera, FileCheck, CreditCard, AlertTriangle, MessageSquare,
  Bike, ArrowRight, RefreshCcw
} from "lucide-react";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { toast } from "sonner";
import { onTableChange } from "@/lib/realtime-bus";
import { acceptOrderOffer, rejectOrderOffer, cancelAssignment } from "@/lib/logistics-engine.functions";
import { pingDriverLocation } from "@/lib/insforge";
import { useCms } from "@/lib/cms-store";
import { useAuth } from "@/lib/auth-store";
import { listTable } from "@/lib/insforge-crud";
import { patchOrder, patchPaymentByOrder, type OrderRow } from "@/lib/orders-api";
import { startNavigation } from "@/lib/navigation";
import { finalizeOrder } from "@/lib/order-completion";
import { updateOrderState } from "@/lib/rider-api";
import { cn } from "@/lib/format";
import { ImageUploader } from "@/components/cravio/ImageUploader";

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
  const { user } = useAuth();
  const cms = useCms();
  const settings = cms?.settings;
  
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [podRef, setPodRef] = useState<any | null>(null);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [eta, setEta] = useState<string | null>(null);

  const riderId = user?.id;


  const loadData = useCallback(async () => {
    if (!riderId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const TIMEOUT = 10000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT)
    );

    try {
      const fetchPromise = listTable<OrderRow>("orders", {
        driver_id: `eq.${riderId}`,
        order: "created_at.desc",
        limit: 5,
      }, { fresh: true, ttl: 0 });

      const rows = await Promise.race([fetchPromise, timeoutPromise]) as OrderRow[];
      
      const active = (rows || []).find((r) => ACTIVE_STATUSES.includes(String(r.status ?? "").toUpperCase())) ?? null;
      setOrder(active);

      if (active) {
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
      }
    } catch (err: any) {
      console.error("[RIDER_ACTIVE] Sync error:", err);
      setError(err.message === "TIMEOUT" 
        ? "Syncing is taking longer than expected." 
        : "Failed to sync delivery state. Tap to retry."
      );
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!riderId) return;
    return onTableChange("orders", (payload) => {
      if (payload.row?.driver_id === riderId) {
        void loadData();
      }
    });
  }, [riderId, loadData]);

  // Periodic ETA refresh
  useEffect(() => {
    if (!order || !["PICKED_UP", "HEADING_TO_CUSTOMER", "ON_THE_WAY"].includes(String(order.status).toUpperCase())) return;
    
    const interval = setInterval(() => {
      // Logic for ETA calculation would go here, using Google Routes API
      // Mocking for now to demonstrate UI update
      setEta(`${Math.floor(Math.random() * 5 + 5)} mins`);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [order]);

  const handleStatusChange = async (newStatus: string, metadata?: any) => {
    if (!order?.id || !riderId || busy) return;
    setBusy(true);
    try {
      await updateOrderState(String(order.id), riderId, newStatus, metadata);
      toast.success(`Status updated: ${STATUS_LABELS[newStatus] || newStatus}`);
      await loadData();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const handleDeliveryComplete = async () => {
    if (!order?.id || !riderId) return;
    if (order.otp_required && otp !== order.otp) {
      toast.error("Invalid delivery PIN");
      return;
    }
    
    setBusy(true);
    try {
      await handleStatusChange("DELIVERED", { 
        delivered_at: new Date().toISOString(),
        payment_status: "PAID",
        pod_image: podRef?.image_url
      });
      
      await patchPaymentByOrder(String(order.id), { status: "PAID" });
      await finalizeOrder(String(order.id));
      
      navigate({ to: "/rider/history" });
    } catch (e) {
      toast.error("Completion failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRetryDelivery = async () => {
    setShowFailedModal(false);
    await handleStatusChange("HEADING_TO_CUSTOMER");
  };



  const currentStatus = String(order?.status ?? "").toUpperCase();
  const isActuallyLoading = loading;
  const isError = !!error;

  if (isActuallyLoading) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center py-20 opacity-40">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em]">Syncing delivery state...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[80svh] flex-col items-center justify-center p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Sync Failed</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {error}
        </p>
        <button 
          onClick={() => void loadData()}
          className="mt-8 rounded-2xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition-all"
        >
          Retry Sync
        </button>
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
          onClick={() => navigate({ to: "/rider/requests" })}
          className="mt-8 rounded-2xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition-all"
        >
          View Requests
        </button>
      </div>
    );
  }

  return (
    <div className="w-full pb-8 animate-fade-up">
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

      <div className="-mt-6 space-y-4 px-4">
        {/* Map Preview with Pathing */}
        <section className="h-64 overflow-hidden rounded-[2.5rem] bg-muted shadow-card ring-1 ring-border/60 relative">
           <GoogleMap 
             className="h-full w-full"
             center={order.pickup_latitude && order.pickup_longitude ? { lat: Number(order.pickup_latitude), lng: Number(order.pickup_longitude) } : undefined}
             zoom={14}
             markers={[
               ...(order.pickup_latitude && order.pickup_longitude ? [{
                 id: "pickup",
                 lat: Number(order.pickup_latitude),
                 lng: Number(order.pickup_longitude),
                 kind: "pickup" as const,
                 label: restaurant?.name || "Pickup"
               }] : []),
               ...(order.delivery_latitude && order.delivery_longitude ? [{
                 id: "dropoff",
                 lat: Number(order.delivery_latitude),
                 lng: Number(order.delivery_longitude),
                 kind: "drop" as const,
                 label: customer?.name || "Drop-off"
               }] : [])
             ]}
             polylines={
               order.pickup_latitude && order.delivery_latitude ? [
                 { 
                   id: "route",
                   points: [
                     { lat: Number(order.pickup_latitude), lng: Number(order.pickup_longitude) },
                     { lat: Number(order.delivery_latitude), lng: Number(order.delivery_longitude) }
                   ],
                   color: "#3B82F6",
                   weight: 4
                 }
               ] : undefined
             }
           />
           {eta && (
             <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 backdrop-blur-sm px-4 py-2 shadow-pop border border-white/20 animate-in slide-in-from-bottom-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-primary">Est. Arrival</p>
                <p className="text-sm font-black text-zinc-900">{eta}</p>
             </div>
           )}
        </section>


        {/* Action Center */}
        <section className="rounded-[2.5rem] bg-card p-6 shadow-card ring-1 ring-border/60">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                 </div>
                 <span className="font-display text-lg font-extrabold">Workflow</span>
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Step {
                currentStatus === "ASSIGNED" ? 1 :
                currentStatus === "HEADING_TO_RESTAURANT" || currentStatus === "ACCEPTED" ? 2 :
                currentStatus === "ARRIVED_AT_RESTAURANT" || currentStatus === "AT_PICKUP" ? 3 :
                currentStatus === "PICKED_UP" || currentStatus === "HEADING_TO_CUSTOMER" ? 4 : 5
              }/5</span>
           </div>

           <div className="space-y-3">
              {currentStatus === "ASSIGNED" && (
                <button onClick={() => handleStatusChange("HEADING_TO_RESTAURANT")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition">
                   Start Trip
                </button>
              )}
              
              {(currentStatus === "ACCEPTED" || currentStatus === "HEADING_TO_RESTAURANT") && (
                <>
                  <button onClick={() => handleStatusChange("ARRIVED_AT_RESTAURANT")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition">
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
                    <button onClick={() => handleStatusChange("PICKED_UP")} className="flex-[2] rounded-2xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow transition">
                      Confirm Pickup
                    </button>
                  </div>
                </div>
              )}

              {(currentStatus === "PICKED_UP" || currentStatus === "HEADING_TO_CUSTOMER" || currentStatus === "ON_THE_WAY") && (
                <>
                  <button onClick={() => handleStatusChange("ARRIVED_AT_CUSTOMER")} className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition">
                    I've Arrived at Customer
                  </button>
                  <button onClick={() => startNavigation({ address: (order.delivery_address as string) || "" })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-xs font-bold uppercase tracking-widest text-foreground transition active:scale-95">
                    <Navigation className="h-4 w-4" /> Navigate to Customer
                  </button>
                  <button onClick={() => setShowFailedModal(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 text-xs font-bold uppercase tracking-widest text-rose-600 transition active:scale-95">
                    <AlertTriangle className="h-4 w-4" /> Unable to Deliver
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

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Proof of Delivery</p>
                    <ImageUploader 
                      type="license"
                      onChange={ref => setPodRef(ref)}
                      value={podRef}
                    />
                  </div>

                  <button 
                    onClick={handleDeliveryComplete} 
                    disabled={busy || !podRef}
                    className="w-full rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-glow active:scale-95 transition disabled:opacity-50"
                  >
                    Complete Delivery
                  </button>

                </div>
              )}
           </div>
        </section>

        {/* Order Details */}
        <section className="rounded-[2.5rem] bg-card p-6 shadow-card ring-1 ring-border/60">
           <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-primary">
                 <Store className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                 <h3 className="font-display text-lg font-extrabold truncate">{restaurant?.name || "Restaurant"}</h3>
                 <p className="text-xs text-muted-foreground truncate">{restaurant?.address || order.pickup_address}</p>
              </div>
              <a href={`tel:${restaurant?.phone || '108'}`} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-primary shadow-soft active:scale-90 transition">
                 <Phone className="h-4 w-4" />
              </a>
           </div>

           <div className="border-t border-border/40 my-6 pt-6">
              <div className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-zinc-900">
                    <User className="h-6 w-6" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg font-extrabold">{customer?.name || "Customer"}</h3>
                    <p className="text-xs text-muted-foreground truncate">{String(order.delivery_address || "")}</p>
                 </div>
                 <div className="flex gap-2">
                    <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-primary shadow-soft active:scale-90 transition">
                       <MessageSquare className="h-4 w-4" />
                    </button>
                    <a href={`tel:${customer?.phone || '100'}`} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted text-zinc-900 shadow-soft active:scale-90 transition">
                       <Phone className="h-4 w-4" />
                    </a>
                 </div>
              </div>
           </div>
        </section>
      </div>

      {/* Failed Delivery Modal */}
      {showFailedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60">
            <div className="flex items-center justify-between mb-6">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <button onClick={() => setShowFailedModal(false)} className="rounded-full bg-muted p-2"><XCircle className="h-4 w-4" /></button>
            </div>
            
            <h3 className="font-display text-xl font-extrabold text-rose-500 italic uppercase tracking-tight">Delivery Failed</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              If you're unable to reach the customer, please try calling them again. If there's still no response, report the issue.
            </p>

            <div className="mt-8 flex flex-col gap-3">
               <button onClick={handleRetryDelivery} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-glow transition">
                  <RefreshCcw className="h-4 w-4" /> Retry Delivery
               </button>
               <button 
                 onClick={() => { handleStatusChange("FAILED"); setShowFailedModal(false); }} 
                 className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-4 text-xs font-black uppercase tracking-widest text-white transition shadow-soft"
               >
                  Report Failure
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
