import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { riderActiveDelivery } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Phone, Navigation, MapPin, Store, User, CheckCircle2, ShieldCheck, Wallet, Star } from "lucide-react";
import { LeafletMap } from "@/components/cravio/LeafletMap";
import { addressCoords, restaurantCoords } from "@/lib/geo";
import { toast } from "sonner";
import { updateDeliveryStatus, pingDriverLocation } from "@/lib/insforge";
import { useCms } from "@/lib/cms-store";

function getDriverId(): string {
  if (typeof window === "undefined") return "guest";
  return window.localStorage.getItem("driverId") || "guest";
}

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

function RiderActive() {
  const d = riderActiveDelivery;
  const navigate = useNavigate();
  const { settings } = useCms();
  const pickup = restaurantCoords(d.restaurant);
  const drop = addressCoords(d.customerAddress);

  const [phase, setPhase] = useState<Phase>("TO_PICKUP");
  const [otp, setOtp] = useState("");
  const [rating, setRating] = useState(0);
  const paymentMethod: "cod" | "prepaid" = (d as any).paymentMethod === "prepaid" ? "prepaid" : "cod";
  const expectedOtp = "4728";

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

  const netEarn = Math.max(0, Math.round(d.payout * (1 - settings.driverCommissionPct / 100)));

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const driverId = getDriverId();
    const send = () => navigator.geolocation.getCurrentPosition(
      (pos) => { void pingDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude); },
      () => {},
      { maximumAge: 15000, timeout: 8000 },
    );
    send();
    const t = setInterval(send, 20000);
    return () => clearInterval(t);
  }, []);

  const advance = (next: Phase, backendStatus?: string) => {
    setPhase(next);
    if (backendStatus) void updateDeliveryStatus(d.id, backendStatus);
  };

  const confirmPickup = () => {
    if (otp.trim() !== expectedOtp) {
      toast.error("Wrong OTP — ask restaurant staff for the 4-digit code");
      return;
    }
    setOtp("");
    advance("PICKED_UP", "PICKED_UP");
    toast.success("Order picked up · heading to customer");
  };

  const arriveDrop = () => advance(paymentMethod === "cod" ? "COLLECT_COD" : "AT_DROP", "ARRIVED");

  const confirmCash = () => {
    advance("DELIVERED", "DELIVERED");
    toast.success(`Cash collected · ${formatPrice(d.payout)}`);
  };

  const completeDelivery = () => {
    advance("DELIVERED", "DELIVERED");
    toast.success(`Delivered · +${formatPrice(netEarn)} earned`);
  };

  const submitRating = () => {
    toast.success("Thanks for the feedback!");
    setTimeout(() => navigate({ to: "/rider" }), 600);
  };

  return (
    <div className="animate-fade-up pb-8">
      <div className="relative h-64 w-full overflow-hidden">
        <LeafletMap
          height="100%"
          interactive={false}
          route={{ from: pickup, to: drop }}
          riderProgress={progress}
          riderLabel="You"
          markers={[
            { id: "p", kind: "pickup", label: d.restaurant, ...pickup },
            { id: "c", kind: "drop", label: d.customer, ...drop },
          ]}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute left-5 right-5 top-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">{PHASE_LABEL[phase]}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{d.id}</h1>
        </div>
      </div>

      <div className="-mt-8 space-y-4 px-5">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-strong p-5 text-primary-foreground shadow-pop">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Trip payout</p>
              <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">{formatPrice(netEarn)}</p>
              <p className="text-[11px] text-white/80">Gross {formatPrice(d.payout)} · {settings.driverCommissionPct}% platform fee</p>
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
              <p className="font-bold">{d.restaurant}</p>
              <p className="text-xs text-muted-foreground">{d.restaurantAddress}</p>
            </div>
            <a href={`tel:${d.restaurantPhone}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Phone className="h-4 w-4" /></a>
          </div>
        </section>

        {/* Customer card */}
        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Customer</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background"><User className="h-5 w-5" /></div>
            <div className="flex-1">
              <p className="font-bold">{d.customer}</p>
              <p className="text-xs text-muted-foreground">{d.customerAddress}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">{d.itemsCount} items</p>
            </div>
            <a href={`tel:${d.customerPhone}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Phone className="h-4 w-4" /></a>
          </div>
        </section>

        <button
          onClick={() => window.open("https://maps.google.com", "_blank")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-4 text-sm font-bold shadow-soft ring-1 ring-border transition active:scale-[0.99]"
        >
          <Navigation className="h-4 w-4 text-primary" /> Open navigation
        </button>

        {/* Phase-specific primary action */}
        {phase === "TO_PICKUP" && (
          <button onClick={() => advance("AT_PICKUP", "ARRIVED_PICKUP")} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
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
            <button onClick={confirmPickup} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
              Confirm pickup
            </button>
            <p className="text-center text-[10px] text-muted-foreground">Demo OTP: 4728</p>
          </section>
        )}

        {phase === "PICKED_UP" && (
          <button onClick={arriveDrop} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
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
              <span className="font-display text-xl font-extrabold">{formatPrice(d.payout)}</span>
            </div>
            <button onClick={confirmCash} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
              Cash received
            </button>
          </section>
        )}

        {phase === "AT_DROP" && (
          <button onClick={completeDelivery} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
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

        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-medium text-muted-foreground">
          <MapPin className="h-3 w-3" /> Live location shared with customer
        </p>
      </div>
    </div>
  );
}
