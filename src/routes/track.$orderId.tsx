import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Phone, Star, MapPin, Clock, ShieldCheck, StickyNote, X } from "lucide-react";
import { useOrders, useAppUI, STATUS_LABEL } from "@/lib/stores";
import { LeafletMap } from "@/components/cravio/LeafletMap";
import { TimelineStepper } from "@/components/cravio/TimelineStepper";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";
import { addressCoords, restaurantCoords, statusToProgress } from "@/lib/geo";
import { toast } from "sonner";

export const Route = createFileRoute("/track/$orderId")({
  head: () => ({ meta: [{ title: "Cravio · Tracking" }] }),
  component: TrackPage,
});

function TrackPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, cancelOrder } = useOrders();
  const { userCoords } = useAppUI();
  const order = getOrder(orderId);
  const canCancel = order && !["PICKED_UP", "ON_THE_WAY", "DELIVERED", "CANCELLED"].includes(order.status);

  if (!order) {
    return (
      <div className="min-h-svh">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button onClick={() => navigate({ to: "/app/orders" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        </header>
        <div className="p-10 text-center">
          <p className="text-sm">We couldn't find that order.</p>
          <Link to="/app/orders" className="mt-3 inline-block text-primary font-semibold">Go to orders</Link>
        </div>
      </div>
    );
  }

  const delivered = order.status === "DELIVERED";
  const pickup = restaurantCoords(order.restaurantId);
  const drop = userCoords ?? addressCoords(order.addressLine || order.addressLabel);

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
          <LeafletMap
            height={260}
            interactive={false}
            route={{ from: pickup, to: drop }}
            riderProgress={statusToProgress(order.status)}
            riderLabel={order.driver.name}
            markers={[
              { id: "r", kind: "restaurant", label: order.restaurantName, ...pickup },
              { id: "c", kind: "customer", label: "Delivery here", ...drop },
            ]}
          />
          <div className="p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">{STATUS_LABEL[order.status]}</div>
            <h2 className="mt-1 font-display text-lg font-bold leading-tight">
              {delivered ? "Delivered. Enjoy your meal!" : `Arriving in ~${Math.max(1, order.etaMins - Math.floor((Date.now() - order.placedAt) / 60000))} min`}
            </h2>
            <p className="text-xs text-muted-foreground">From {order.restaurantName}</p>
          </div>
        </div>

        {!delivered && (
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

        {delivered && (
          <Button onClick={() => navigate({ to: "/app" })} className="h-14 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow">
            Order again
          </Button>
        )}
      </div>
    </div>
  );
}
