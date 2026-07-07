import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { riderEarnings, deliveryRequests } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Bike, TrendingUp, Clock, Package, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/format";
import { setDriverOnline } from "@/lib/insforge";

function getDriverId(): string {
  if (typeof window === "undefined") return "guest";
  return window.localStorage.getItem("driverId") || "guest";
}

export const Route = createFileRoute("/rider/")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Home" }] }),
  component: RiderHome,
});

function RiderHome() {
  const [online, setOnline] = useState(true);
  const { today } = riderEarnings;

  return (
    <div className="animate-fade-up space-y-6 px-5 pt-7">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Rider</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Hey, Aarav</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className="font-bold text-foreground">4.95</span> · 312 trips
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Bike className="h-7 w-7 text-primary" strokeWidth={2.4} />
        </div>
      </header>

      <div className={cn(
        "relative overflow-hidden rounded-3xl p-5 shadow-pop transition-colors",
        online ? "bg-gradient-to-br from-primary to-primary-strong text-primary-foreground" : "bg-card",
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", online ? "text-white/80" : "text-muted-foreground")}>Status</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{online ? "You're online" : "You're offline"}</p>
            <p className={cn("mt-1 text-xs", online ? "text-white/80" : "text-muted-foreground")}>
              {online ? "Accepting new delivery requests" : "Toggle on to start earning"}
            </p>
          </div>
          <button
            onClick={() => { const next = !online; setOnline(next); void setDriverOnline(getDriverId(), next); }}
            className={cn(
              "relative h-9 w-16 rounded-full p-1 transition",
              online ? "bg-white/30" : "bg-muted",
            )}
            aria-label="Toggle online"
          >
            <span className={cn(
              "block h-7 w-7 rounded-full bg-white shadow-card transition-transform",
              online && "translate-x-7",
            )} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={TrendingUp} label="Earned" value={formatPrice(today.total)} tone="text-primary bg-primary/10" />
        <Stat icon={Package} label="Trips" value={String(today.deliveries)} tone="text-sky-700 bg-sky-100" />
        <Stat icon={Clock} label="Online" value={`${today.hours}h`} tone="text-amber-700 bg-amber-100" />
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Upcoming nearby</h2>
          <Link to="/rider/requests" className="flex items-center gap-1 text-[11px] font-bold text-primary">
            All requests <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2.5">
          {deliveryRequests.slice(0, 2).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold">{r.restaurant}</p>
                <p className="text-[11px] text-muted-foreground">{r.distanceKm} km · {r.etaMins} min</p>
              </div>
              <span className="font-display text-sm font-extrabold text-primary">{formatPrice(r.payout)}</span>
            </div>
          ))}
        </div>
      </section>

      <Link to="/rider/active" className="flex items-center justify-between rounded-3xl bg-foreground p-5 text-background shadow-pop transition active:scale-[0.99]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-background/70">Active delivery</p>
          <p className="mt-1 font-display text-lg font-extrabold">DLV-3300 · in progress</p>
          <p className="mt-0.5 text-xs text-background/70">1.6 km left · ~8 min to customer</p>
        </div>
        <ChevronRight className="h-5 w-5" />
      </Link>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </div>
      <p className="mt-2.5 font-display text-lg font-extrabold tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
