import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { riderActiveDelivery } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Phone, Navigation, MapPin, Store, User, CheckCircle2 } from "lucide-react";
import { MapStylized } from "@/components/cravio/MapStylized";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/active")({
  head: () => ({ meta: [{ title: "Cravio Rider · Active" }] }),
  component: RiderActive,
});

function RiderActive() {
  const d = riderActiveDelivery;
  const navigate = useNavigate();

  return (
    <div className="animate-fade-up pb-8">
      <div className="relative h-64 w-full overflow-hidden">
        <MapStylized status="ON_THE_WAY" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute left-5 right-5 top-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/70">Active delivery</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{d.id}</h1>
        </div>
      </div>

      <div className="-mt-8 space-y-4 px-5">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-strong p-5 text-primary-foreground shadow-pop">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Arriving in</p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight">{d.etaMins} min</p>
              <p className="text-xs text-white/80">{d.distanceLeftKm} km · heading to customer</p>
            </div>
            <span className="font-display text-2xl font-extrabold">{formatPrice(d.payout)}</span>
          </div>
        </div>

        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Pickup</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">{d.restaurant}</p>
              <p className="text-xs text-muted-foreground">{d.restaurantAddress}</p>
            </div>
            <a href={`tel:${d.restaurantPhone}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Customer</p>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">{d.customer}</p>
              <p className="text-xs text-muted-foreground">{d.customerAddress}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">{d.itemsCount} items</p>
            </div>
            <a href={`tel:${d.customerPhone}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </section>

        <button
          onClick={() => { window.open("https://maps.google.com", "_blank"); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-4 text-sm font-bold shadow-soft ring-1 ring-border transition active:scale-[0.99]"
        >
          <Navigation className="h-4 w-4 text-primary" />
          Open navigation
        </button>

        <button
          onClick={() => { toast.success("Delivery completed · +$7.50 earned"); setTimeout(() => navigate({ to: "/rider" }), 800); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark as delivered
        </button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-medium text-muted-foreground">
          <MapPin className="h-3 w-3" /> Live location shared with customer
        </p>
      </div>
    </div>
  );
}
