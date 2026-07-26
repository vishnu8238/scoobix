import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Bike, TrendingUp, Clock, Package, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/format";
import { setDriverOnline } from "@/lib/insforge";
import { useDriver } from "@/lib/driver-store";
import { useAuth } from "@/lib/auth-store";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/rider/")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Home" }] }),
  component: RiderHome,
});

type OrderRow = {
  id: string;
  status?: string;
  driver_id?: string | null;
  delivery_fee?: number;
  delivery_address?: string;
  created_at?: string;
};

const ACTIVE = ["ASSIGNED", "ACCEPTED", "READY", "AT_PICKUP", "PICKED_UP", "ON_THE_WAY", "ARRIVED"];

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function RiderHome() {
  const { user } = useAuth();
  const { driver, driverId, update } = useDriver();
  const [online, setOnline] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [offers, setOffers] = useState<OrderRow[]>([]);

  useEffect(() => { setOnline(Boolean(driver?.online_status)); }, [driver?.online_status]);

  const load = useCallback(async () => {
    if (!driverId) return;
    const [mine, pending] = await Promise.all([
      listTable<OrderRow>("orders", { driver_id: `eq.${driverId}`, order: "created_at.desc", limit: 100 }),
      listTable<OrderRow>("orders", { driver_id: `eq.${driverId}`, status: "eq.ASSIGNING", limit: 3 }),
    ]);
    setOrders(mine);
    setOffers(pending);
  }, [driverId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(t);
  }, [load]);

  const today = useMemo(() => {
    const done = orders.filter((o) => String(o.status ?? "").toUpperCase() === "DELIVERED" && isToday(o.created_at));
    const total = done.reduce((s, o) => s + (Number(o.delivery_fee ?? 0) || 0), 0);
    return { total, deliveries: done.length };
  }, [orders]);

  const active = useMemo(
    () => orders.find((o) => ACTIVE.includes(String(o.status ?? "").toUpperCase())) ?? null,
    [orders],
  );

  const firstName = (user?.name ?? "Rider").split(" ")[0];

  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    await update({ online_status: next });
    if (driverId) void setDriverOnline(driverId, next);
  };

  return (
    <div className="animate-fade-up space-y-6 px-5 pt-7">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Rider</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Hey, {firstName}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className="font-bold text-foreground">{(driver?.rating ?? 5).toFixed(2)}</span> · {driver?.total_deliveries ?? 0} trips
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
            onClick={() => void toggleOnline()}
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
        <Stat icon={Clock} label="Pending" value={formatPrice(driver?.pending_earnings ?? 0)} tone="text-amber-700 bg-amber-100" />
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Upcoming nearby</h2>
          <Link to="/rider/requests" className="flex items-center gap-1 text-[11px] font-bold text-primary">
            All requests <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {offers.length === 0 ? (
          <p className="rounded-2xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            {online ? "No requests right now — stay tuned." : "Go online to receive requests."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {offers.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold">#{String(r.id).slice(-5).toUpperCase()}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.delivery_address ?? "New request"}</p>
                </div>
                <span className="font-display text-sm font-extrabold text-primary">{formatPrice(Number(r.delivery_fee ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {active && (
        <Link to="/rider/active" className="flex items-center justify-between rounded-3xl bg-foreground p-5 text-background shadow-pop transition active:scale-[0.99]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-background/70">Active delivery</p>
            <p className="mt-1 font-display text-lg font-extrabold">#{String(active.id).slice(-5).toUpperCase()} · in progress</p>
            <p className="mt-0.5 truncate text-xs text-background/70">{active.delivery_address ?? "Tap to continue"}</p>
          </div>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
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
