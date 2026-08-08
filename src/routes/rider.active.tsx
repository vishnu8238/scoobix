import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Phone, Navigation, MapPin, Store, User, CheckCircle2, ShieldCheck, Wallet, Star, Loader2, PackageOpen, Battery, Zap, Bell, Volume2, Info, XCircle } from "lucide-react";
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

export const Route = createFileRoute("/rider/active")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Active" }] }),
  component: RiderActive,
});

type Phase =
  | "TO_PICKUP"
  | "AT_PICKUP"
  | "PICKED_UP"
  | "AT_DROP"
  | "COLLECT_COD"
  | "DELIVERED"
  | "FEEDBACK";

const PHASE_LABEL: Record<Phase, string> = {
  TO_PICKUP: "Heading to restaurant",
  AT_PICKUP: "At restaurant",
  PICKED_UP: "En route to customer",
  AT_DROP: "At drop-off",
  COLLECT_COD: "Collect payment",
  DELIVERED: "Delivered",
  FEEDBACK: "Rate this trip",
};

const ACTIVE_STATUSES = ["ASSIGNED", "ACCEPTED", "READY", "PICKED_UP", "ON_THE_WAY", "ARRIVED", "AT_PICKUP"];

type RestaurantRow = { id: string; name?: string; address?: string; latitude?: number; longitude?: number };
type UserRow = { id: string; name?: string; phone?: string };

function phaseFromStatus(status: string): Phase {
  const s = status.toUpperCase();
  if (s === "PICKED_UP") return "PICKED_UP";
  if (s === "ON_THE_WAY") return "PICKED_UP";
  if (s === "ARRIVED") return "AT_DROP";
  if (s === "AT_PICKUP") return "AT_PICKUP";
  if (s === "DELIVERED") return "DELIVERED";
  return "TO_PICKUP";
}

function RiderActive() {
  const navigate = useNavigate();
  const { settings } = useCms();
  const { driver, driverId, loading: driverLoading, update: updateDriver } = useDriver();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [activeOffer, setActiveOffer] = useState<any | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [customer, setCustomer] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("TO_PICKUP");
  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  
  // --- Power Saving & Notifications ---
  const [powerSaving, setPowerSaving] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rider_power_saving") === "true";
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    localStorage.setItem("rider_power_saving", String(powerSaving));
  }, [powerSaving]);

  // --- Acceptance Timer ---
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      setActiveOffer(null);
      setTimeLeft(null);
      return;
    }
    const t = setInterval(() => setTimeLeft(prev => prev !== null ? prev - 1 : null), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // --- Realtime Offer Monitoring ---
  useEffect(() => {
    if (!driverId) return;
    return onTableChange("rider_offers", (payload) => {
      const offer = payload.row as any;
      if (!offer) return;
      
      // New offer for me
      if (offer.rider_id === driverId && offer.status === "PENDING" && payload.op === "insert") {
        setActiveOffer(offer);
        const expires = new Date(offer.expires_at).getTime();
        const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setTimeLeft(diff);
        
        if (soundEnabled) {
          // Play notification sound logic
          const audio = new Audio("/assets/notification.mp3");
          audio.play().catch(() => {});
        }
        
        if (Notification.permission === "granted") {
          new Notification("New Scoobix Order", {
            body: `₹${offer.estimated_earnings} · ${offer.restaurant_name || "Restaurant"}`,
            icon: "/favicon.ico",
            tag: "new-order"
          });
        }
      }
      
      // Offer expired or cancelled by system
      if (offer.id === activeOffer?.id && (offer.status === "EXPIRED" || offer.status === "CANCELLED")) {
        setActiveOffer(null);
        setTimeLeft(null);
      }
    });
  }, [driverId, activeOffer?.id, soundEnabled]);

  // --- Load active offer if exists ---
  const checkPendingOffer = useCallback(async () => {
    if (!driverId) return;
    const offers = await listTable<any>("rider_offers", {
      rider_id: `eq.${driverId}`,
      status: "eq.PENDING",
      limit: 1
    });
    if (offers.length > 0) {
      const offer = offers[0];
      const expires = new Date(offer.expires_at).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      if (diff > 0) {
        setActiveOffer(offer);
        setTimeLeft(diff);
      }
    }
  }, [driverId]);

  useEffect(() => { void checkPendingOffer(); }, [checkPendingOffer]);

  // ---- load the driver's active order -----------------------------------
  const load = useCallback(async () => {
    if (!driverId) { setOrder(null); setLoading(false); return; }
    const rows = await listTable<OrderRow>("orders", {
      driver_id: `eq.${driverId}`,
      order: "created_at.desc",
      limit: 10,
    });
    const active = rows.find((r) => ACTIVE_STATUSES.includes(String(r.status ?? "").toUpperCase())) ?? null;
    setOrder(active);
    if (active) setPhase((p) => (p === "FEEDBACK" ? p : phaseFromStatus(String(active.status ?? ""))));
    setLoading(false);

    if (active?.restaurant_id) {
      const rs = await listTable<RestaurantRow>("restaurants", { id: `eq.${active.restaurant_id}`, limit: 1 });
      setRestaurant(rs[0] ?? null);
    }
    if (active?.customer_id) {
      const us = await listTable<UserRow>("users", { id: `eq.${active.customer_id}`, limit: 1 });
      setCustomer(us[0] ?? null);
    }
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);

  // ---- live location ping (adaptive based on power saving) -------------
  useEffect(() => {
    if (!driverId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    
    // In power saving, idle riders ping less (60s vs 20s). 
    // Active orders always ping at operational frequency (20s).
    const interval = order ? 20000 : (powerSaving ? 60000 : 20000);
    
    const send = () => navigator.geolocation.getCurrentPosition(
      (pos) => {
        void pingDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude);
        void updateDriver({ current_lat: pos.coords.latitude, current_lng: pos.coords.longitude });
      },
      () => {},
      { maximumAge: 15000, timeout: 8000 },
    );
    send();
    const t = setInterval(send, interval);
    return () => clearInterval(t);
  }, [driverId, order?.id, powerSaving]);

  const meta = useMemo(() => {
    const raw = order?.items;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const m = (raw as { meta?: Record<string, unknown> }).meta;
      return (m ?? {}) as Record<string, unknown>;
    }
    return {} as Record<string, unknown>;
  }, [order]);

  const itemCount = useMemo(() => {
    const raw = order?.items;
    const lines = Array.isArray(raw) ? raw : ((raw as { lines?: unknown[] } | undefined)?.lines ?? []);
    return Array.isArray(lines) ? lines.reduce((n, l) => n + Number((l as { qty?: number }).qty ?? 1), 0) : 0;
  }, [order]);

  const paymentMethod: "cod" | "prepaid" =
    String(order?.payment_method ?? "cash").toLowerCase() === "cash" ? "cod" : "prepaid";
  const grossPayout = Number(order?.delivery_fee ?? 0) || 0;
  const netEarn = Math.max(0, Math.round(grossPayout * (1 - settings.driverCommissionPct / 100)));
  const collectAmount = Number(order?.total_price ?? 0) || 0;
  const dropAddress = String(order?.delivery_address ?? (meta.addressLine as string) ?? "");
  const restaurantName = String(restaurant?.name ?? meta.restaurantName ?? "Restaurant");

  const progress = useMemo(() => {
    switch (phase) {
      case "TO_PICKUP": return 0.15;
      case "AT_PICKUP": return 0.35;
      case "PICKED_UP": return 0.6;
      case "AT_DROP":
      case "COLLECT_COD": return 0.9;
      default: return 1;
    }
  }, [phase]);
  void progress;

  // ---- actions -----------------------------------------------------------
  const advance = async (next: Phase, backendStatus?: string) => {
    setPhase(next);
    if (backendStatus && order?.id) {
      setBusy(true);
      const ok = await patchOrder(String(order.id), { status: backendStatus });
      setBusy(false);
      if (!ok) toast.error("Couldn't sync status — check your connection");
      else setOrder((o) => (o ? { ...o, status: backendStatus } : o));
    }
  };

  const confirmPickup = async () => {
    const expected = String(order?.otp ?? "");
    if (!expected) {
      toast.error("No pickup code on this order");
      return;
    }
    if (otp.trim() !== expected) {
      toast.error("Wrong OTP — ask restaurant staff for the 4-digit code");
      return;
    }
    setOtp("");
    await advance("PICKED_UP", "PICKED_UP");
    toast.success("Order picked up · heading to customer");
  };

  const arriveDrop = () => void advance(paymentMethod === "cod" ? "COLLECT_COD" : "AT_DROP", "ARRIVED");

  const complete = async (cash: boolean) => {
    if (!order?.id) return;
    setBusy(true);
    const id = String(order.id);
    const ok = await patchOrder(id, { status: "DELIVERED", payment_status: "PAID" });
    if (ok) {
      void patchPaymentByOrder(id, { status: "PAID" });
      void updateDriver({
        current_order_id: null,
        total_deliveries: (driver?.total_deliveries ?? 0) + 1,
      });
      void finalizeOrder(id);
    }
    setBusy(false);
    setPhase("DELIVERED");
    toast.success(cash ? `Cash collected · ${formatPrice(collectAmount)}` : `Delivered · +${formatPrice(netEarn)} earned`);
  };

  const submitRating = () => {

    toast.success("Thanks for the feedback!");
    setTimeout(() => navigate({ to: "/rider" }), 600);
  };

  const navigateNow = () => {
    // Before pickup → restaurant coordinates. After pickup → customer address.
    const target = phase === "TO_PICKUP" || phase === "AT_PICKUP"
      ? { lat: restaurant?.latitude, lng: restaurant?.longitude, address: restaurant?.address ?? restaurantName }
      : { address: dropAddress };
    if (!startNavigation(target)) toast.error("No destination available for this trip");
  };

  // ---- actions -----------------------------------------------------------
  const handleAccept = async () => {
    if (!activeOffer || busy) return;
    setBusy(true);
    const res = await acceptOrderOffer({ 
      orderId: activeOffer.order_id, 
      riderId: driverId!, 
      offerId: activeOffer.id 
    });
    if (res.success) {
      toast.success("Order accepted!");
      setActiveOffer(null);
      setTimeLeft(null);
      void load(); // Reload to show the active trip
    } else {
      toast.error(res.error || "Failed to accept order");
    }
    setBusy(false);
  };

  const handleReject = async () => {
    if (!activeOffer || busy) return;
    setBusy(true);
    await rejectOrderOffer({ 
      orderId: activeOffer.order_id, 
      offerId: activeOffer.id 
    });
    setActiveOffer(null);
    setTimeLeft(null);
    setBusy(false);
    toast.info("Order rejected");
  };

  const handleSelfCancel = async () => {
    if (!order?.id || busy) return;
    if (!confirm("Are you sure you want to cancel this delivery? This may affect your rating.")) return;
    setBusy(true);
    await cancelAssignment({ orderId: String(order.id), riderId: driverId! });
    setOrder(null);
    setBusy(false);
    toast.info("Delivery cancelled");
  };

  // ---- empty / loading states -------------------------------------------
  if (driverLoading || loading) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your trip…</p>
      </div>
    );
  }

  // ---- NEW ORDER OVERLAY (Modal) ----
  if (activeOffer) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in zoom-in duration-300">
        <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-glow">
                <Bell className="h-10 w-10 text-primary-foreground animate-bounce" />
              </div>
              <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 font-display font-black text-white shadow-pop">
                {timeLeft}
              </div>
            </div>
            
            <p className="eyebrow text-primary">New Delivery Order</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight">₹{activeOffer.estimated_earnings}</h2>
            <p className="text-sm text-muted-foreground">Estimated earnings</p>
            
            <div className="mt-6 w-full space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 text-left">
                <Store className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-bold">{activeOffer.restaurant_name || "Restaurant"}</p>
                  <p className="text-[10px] text-muted-foreground">{activeOffer.pickup_distance} km · {activeOffer.pickup_area || "Pickup Area"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 text-left">
                <MapPin className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold">{activeOffer.delivery_area || "Customer Area"}</p>
                  <p className="text-[10px] text-muted-foreground">Approx. {activeOffer.delivery_distance} km trip</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex w-full gap-3">
              <button 
                disabled={busy}
                onClick={handleReject}
                className="flex-1 rounded-2xl bg-muted py-4 text-sm font-bold transition active:scale-95 disabled:opacity-50"
              >
                Reject
              </button>
              <button 
                disabled={busy}
                onClick={handleAccept}
                className="flex-[2] rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PackageOpen className="h-7 w-7" />
        </div>
        <h1 className="font-display text-xl font-extrabold">No active delivery</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Accepted orders appear here. Toggle Power Saving to save battery while waiting.
        </p>
        
        <div className="mt-6 flex flex-col gap-3 w-full max-w-[240px]">
          <button 
            onClick={() => setPowerSaving(!powerSaving)}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${powerSaving ? "bg-emerald-500 text-white" : "bg-card ring-1 ring-border text-foreground"}`}
          >
            {powerSaving ? <Zap className="h-4 w-4" /> : <Battery className="h-4 w-4" />}
            {powerSaving ? "Power Saving ON" : "Power Saving OFF"}
          </button>
          
          <button 
            onClick={() => {
              if (Notification.permission === "default") {
                Notification.requestPermission().then(p => {
                  if (p === "granted") toast.success("Notifications enabled!");
                });
              }
              setSoundEnabled(!soundEnabled);
              toast.success(`Sound ${soundEnabled ? "Disabled" : "Enabled"}`);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-card py-3 text-sm font-bold ring-1 ring-border text-foreground transition"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            {soundEnabled ? "Sound: ON" : "Sound: OFF"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up pb-8">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 to-primary/5 px-5 pb-12 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">{PHASE_LABEL[phase]}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">#{String(order.id).slice(-5).toUpperCase()}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{restaurantName} → {dropAddress || "Customer"}</p>
      </div>

      <div className="-mt-8 space-y-4 px-5">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-strong p-5 text-primary-foreground shadow-pop">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Trip payout</p>
              <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">{formatPrice(netEarn)}</p>
              <p className="text-[11px] text-white/80">Gross {formatPrice(grossPayout)} · {settings.driverCommissionPct}% platform fee</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${paymentMethod === "cod" ? "bg-white/20" : "bg-emerald-400/30"}`}>
              {paymentMethod === "cod" ? "COD" : "Prepaid"}
            </span>
          </div>
        </div>

        {/* Phase stepper */}
        <div className="flex items-center justify-between gap-1">
          {(["TO_PICKUP","AT_PICKUP","PICKED_UP","AT_DROP","DELIVERED"] as Phase[]).map((p, i) => {
            const idx = ["TO_PICKUP","AT_PICKUP","PICKED_UP","AT_DROP","DELIVERED"].indexOf(phase);
            const done = i <= idx || (phase === "COLLECT_COD" && i <= 3) || phase === "FEEDBACK";
            return (
              <div key={p} className="flex flex-1 items-center gap-1">
                <div className={`h-1.5 flex-1 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />
              </div>
            );
          })}
        </div>

        {/* Pickup card */}
        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Pickup</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-5 w-5" /></div>
            <div className="flex-1">
              <p className="font-bold">{restaurantName}</p>
              <p className="text-xs text-muted-foreground">{restaurant?.address ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* Customer card */}
        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Customer</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background"><User className="h-5 w-5" /></div>
            <div className="flex-1">
              <p className="font-bold">{customer?.name ?? "Customer"}</p>
              <p className="text-xs text-muted-foreground">{dropAddress}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">{itemCount} items</p>
            </div>
            {customer?.phone && (
              <a href={`tel:${customer.phone}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Phone className="h-4 w-4" /></a>
            )}
          </div>
        </section>

        <button
          onClick={navigateNow}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-4 text-sm font-bold shadow-soft ring-1 ring-border transition active:scale-[0.99]"
        >
          <Navigation className="h-4 w-4 text-primary" />
          {phase === "TO_PICKUP" || phase === "AT_PICKUP" ? "Navigate to restaurant" : "Navigate to customer"}
        </button>

        {/* Phase-specific primary action */}
        {phase === "TO_PICKUP" && (
          <button disabled={busy} onClick={() => void advance("AT_PICKUP", "AT_PICKUP")} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-60">
            I've arrived at the restaurant
          </button>
        )}

        {phase === "AT_PICKUP" && (
          <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-4 w-4" /> Pickup verification
            </div>
            <p className="text-xs text-muted-foreground">Ask restaurant staff for the 4-digit pickup OTP.</p>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              inputMode="numeric"
              className="w-full rounded-2xl bg-muted/40 px-4 py-3 text-center font-display text-2xl font-extrabold tracking-[0.5em] outline-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary/40"
            />
            <button disabled={busy} onClick={() => void confirmPickup()} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-60">
              Confirm pickup
            </button>
          </section>
        )}

        {phase === "PICKED_UP" && (
          <button disabled={busy} onClick={arriveDrop} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-60">
            I've reached the customer
          </button>
        )}

        {phase === "COLLECT_COD" && (
          <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Wallet className="h-4 w-4" /> Cash on delivery
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Amount to collect</span>
              <span className="font-display text-xl font-extrabold">{formatPrice(collectAmount)}</span>
            </div>
            <button disabled={busy} onClick={() => void complete(true)} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-60">
              Cash received
            </button>
          </section>
        )}

        {phase === "AT_DROP" && (
          <button disabled={busy} onClick={() => void complete(false)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-60">
            <CheckCircle2 className="h-4 w-4" /> Mark as delivered
          </button>
        )}

        {phase === "DELIVERED" && (
          <button onClick={() => setPhase("FEEDBACK")} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
            Rate this trip
          </button>
        )}

        {phase === "FEEDBACK" && (
          <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60 space-y-3">
            <p className="eyebrow">How was the trip?</p>
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="p-1">
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <button onClick={submitRating} disabled={rating === 0} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95 disabled:opacity-40">
              Submit & finish
            </button>
          </section>
        )}

        <button
          onClick={handleSelfCancel}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-bold text-rose-500 transition active:scale-[0.99] opacity-60 hover:opacity-100"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel Delivery
        </button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-medium text-muted-foreground">
          <MapPin className="h-3 w-3" /> Live location shared with customer
        </p>
      </div>
    </div>
  );
}
