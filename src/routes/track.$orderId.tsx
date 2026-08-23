import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Phone, Star, MapPin, Clock, ShieldCheck, StickyNote, X } from "lucide-react";
import { useOrders, useAppUI, STATUS_LABEL } from "@/lib/stores";
import { MapView } from "@/components/maps/MapView";
import { TimelineStepper } from "@/components/cravio/TimelineStepper";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";
import { addressCoords, restaurantCoords, statusToProgress, CITY_CENTER } from "@/lib/geo";
import { toast } from "sonner";
import { subscribeToDelivery, subscribeToDriverLocation } from "@/lib/delivery-sync";
import { initGoogleMaps, routeBetween } from "@/lib/maps-service";

import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/track/$orderId")({
  head: () => ({ meta: [{ title: "Scoobix · Tracking" }] }),
  component: TrackPage,
});

function TrackPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, cancelOrder, subscribeToOrders, loading } = useOrders();
  const { user } = useAuth();
  const { userCoords } = useAppUI();
  const [error, setError] = useState<string | null>(null);
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveEta, setLiveEta] = useState<{ mins: number; km: number; at: number } | null>(null);
  // Path actually taken by the rider so far
  const [trail, setTrail] = useState<{ lat: number; lng: number }[]>([]);
  // Remaining road path from the rider to the customer
  const [routePath, setRoutePath] = useState<{ lat: number; lng: number }[]>([]);


  
  // Real-time synchronization
  useEffect(() => {
    if (!user?.id || !orderId) return;
    const unsubOrders = subscribeToOrders(user.id);
    const unsubLocation = subscribeToDriverLocation(orderId, (coords) => {
      setDriverCoords(coords);
      setTrail((prev) => {
        const last = prev[prev.length - 1];
        // Skip duplicate/near-identical pings (< ~10m) to keep the polyline clean
        if (last && Math.abs(last.lat - coords.lat) < 0.0001 && Math.abs(last.lng - coords.lng) < 0.0001) return prev;
        const next = [...prev, coords];
        return next.length > 300 ? next.slice(next.length - 300) : next;
      });
    });
    return () => { 
      unsubOrders(); 
      unsubLocation();
    };
  }, [user?.id, orderId, subscribeToOrders]);


  const order = getOrder(orderId);

  // Handle errors or missing orders
  useEffect(() => {
    if (!loading && !order && orderId) {
      setError("We couldn't find that order.");
    } else {
      setError(null);
    }
  }, [loading, order, orderId]);

  // Live travel-time estimate from the rider's real position to the drop-off
  const dropTarget = order ? (userCoords ?? addressCoords(order.addressLine || order.addressLabel || "Default")) : null;
  const originForEta = driverCoords ?? (order?.restaurantId ? restaurantCoords(order.restaurantId) : null);
  const activeDelivery = !!order && !["DELIVERED", "CANCELLED", "REJECTED"].includes(order.status);

  useEffect(() => {
    if (!activeDelivery || !dropTarget || !originForEta) return;
    let alive = true;
    (async () => {
      await initGoogleMaps();
      const r = await routeBetween(originForEta, dropTarget);
      if (!alive || !r) return;
      setLiveEta({ mins: Math.max(1, r.durationMins), km: r.distanceKm, at: Date.now() });
      setRoutePath(r.coords ?? []);
    })();
    return () => { alive = false; };
  }, [activeDelivery, originForEta?.lat, originForEta?.lng, dropTarget?.lat, dropTarget?.lng]);


  // Tick so the countdown and arrival clock stay current
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeDelivery) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [activeDelivery]);

  const fallbackEta = order ? order.etaMins - Math.floor((now - order.placedAt) / 60000) : 0;
  const etaMins = Math.max(
    1,
    liveEta ? liveEta.mins - Math.floor((now - liveEta.at) / 60000) : fallbackEta
  );


  if (loading && !order) {
    return (
      <div className="min-h-svh flex flex-col">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-svh">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button onClick={() => navigate({ to: "/app/orders" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        </header>
        <div className="p-10 text-center flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <X className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold mb-1">Order Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-[240px]">{error || "This order may have been deleted or is inaccessible."}</p>
          <Button variant="link" onClick={() => navigate({ to: "/app/orders" })} className="mt-4 font-bold text-primary">
            Back to my orders
          </Button>
        </div>
      </div>
    );
  }

  const delivered = order.status === "DELIVERED";
  const pickup = order.restaurantId ? restaurantCoords(order.restaurantId) : CITY_CENTER;
  const drop = userCoords ?? addressCoords(order.addressLine || order.addressLabel || "Default");
  const canCancel = !["PICKED_UP", "ON_THE_WAY", "DELIVERED", "CANCELLED", "REJECTED"].includes(order.status);



  return (
    <div className="min-h-svh pb-8">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/orders" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="truncate text-center font-display text-base font-bold">Order #{order.id.slice(-5)}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live</span>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-3xl bg-card shadow-card ring-1 ring-border/60 overflow-hidden">
          <MapView
            height={260}
            interactive={false}
            route={routePath.length > 1 ? undefined : { 
              from: pickup, 
              to: drop
            }}
            riderProgress={driverCoords ? undefined : statusToProgress(order.status)}
            riderLabel={order.driver.name}
            polylines={[
              // Remaining road path ahead of the rider
              ...(routePath.length > 1
                ? [{ id: "remaining", points: routePath, color: "#94A3B8", weight: 4, dash: true }]
                : []),
              // Path already travelled by the rider
              ...(trail.length > 1
                ? [{ id: "trail", points: trail, color: "#3B82F6", weight: 5 }]
                : []),
            ]}
            markers={[
              { id: "r", kind: "restaurant", label: order.restaurantName, ...pickup },
              { id: "c", kind: "customer", label: "Delivery here", ...drop },
              ...(driverCoords ? [{ id: "d", kind: "rider" as const, label: order.driver.name, ...driverCoords }] : [])
            ]}
            />

          <div className="p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">{STATUS_LABEL[order.status]}</div>
            <h2 className="mt-1 font-display text-lg font-bold leading-tight">
              {delivered 
                ? "Delivered. Enjoy your meal!" 
                : order.status === "CANCELLED" 
                  ? "Order Cancelled"
                  : `Arriving in ~${etaMins} min`}
            </h2>
            <p className="text-xs text-muted-foreground">From {order.restaurantName}</p>
            {!delivered && order.status !== "CANCELLED" && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  {new Date(now + etaMins * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {liveEta && (
                  <>
                    <span>{liveEta.km.toFixed(1)} km away</span>
                    <span className="flex items-center gap-1 text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      {driverCoords ? "Live rider ETA" : "Live route ETA"}
                    </span>
                  </>
                )}
              </div>
            )}



          </div>
        </div>

        {!delivered && order.status !== "CANCELLED" && (
          <div className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="grid h-12 w-12 place-items-center rounded-full gradient-primary text-primary-foreground font-bold">{order.driver.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{order.driver.name}</div>
              <div className="truncate text-xs text-muted-foreground">{order.driver.vehicle}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Star className="h-3 w-3 fill-primary text-primary" />{order.driver.rating.toFixed(2)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success(`Calling ${order.driver.name}…`)} className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><Phone className="h-4 w-4" /></button>
              <button onClick={() => toast.success("Message sent")} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><MessageSquare className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h3 className="text-sm font-bold">Progress</h3>
          <div className="mt-4">
            <TimelineStepper status={order.status} />
          </div>
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 text-sm">
          <h3 className="font-bold">Delivery details</h3>
          <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <span><b className="text-foreground">{order.addressLabel}</b> · {order.addressLine}</span>
          </div>
          <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <span>Placed {new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Paid with {order.paymentLabel}</span>
          </div>
          {order.deliveryInstructions && (
            <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>{order.deliveryInstructions}{order.contactless ? " · Contactless" : ""}</span>
            </div>
          )}
          {!order.deliveryInstructions && order.contactless && (
            <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>Contactless delivery</span>
            </div>
          )}
          {order.notes && (
            <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <span>"{order.notes}"</span>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 text-sm">
          <h3 className="font-bold">Order</h3>
          <ul className="mt-2 space-y-1.5">
            {order.items.map((it) => (
              <li key={it.lineId} className="flex justify-between text-xs">
                <span className="truncate"><b>{it.qty}×</b> {it.name}</span>
                <span>{currency(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-border" />
          <div className="flex justify-between text-sm font-bold"><span>Total paid</span><span>{currency(order.total)}</span></div>
        </div>

        {(delivered || order.status === "CANCELLED") && (
          <Button onClick={() => navigate({ to: "/app" })} className="h-14 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow">
            {order.status === "CANCELLED" ? "Order again" : "Order again"}
          </Button>
        )}

        {canCancel && (
          <Button
            variant="outline"
            onClick={async () => {
              if (window.confirm("Are you sure you want to cancel this order?")) {
                const res = await cancelOrder(order.id);
                if (res.ok) { toast.success(res.message); }
                else toast.error(res.message);
              }
            }}
            className="h-12 w-full rounded-full text-sm font-bold text-destructive border-destructive/40 hover:bg-destructive/5"
          >
            <X className="mr-1.5 h-4 w-4" /> Cancel order
          </Button>
        )}

      </div>
    </div>
  );
}
