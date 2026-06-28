import { createFileRoute } from "@tanstack/react-router";
import { partnerOrders, partnerRestaurant } from "@/lib/role-data";
import { TrendingUp, Clock, CheckCircle2, DollarSign, BellRing, ChefHat, Power, StoreIcon } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useCms } from "@/lib/cms-store";
import { Switch } from "@/components/ui/switch";
import { updateRestaurantStatus } from "@/lib/insforge";

export const Route = createFileRoute("/partner/")({
  head: () => ({ meta: [{ title: "Cravio Partner · Dashboard" }] }),
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const { closedRestaurants, setRestaurantClosed, acceptingOrders, setAcceptingOrders } = useCms();
  const rid = partnerRestaurant.id;
  const isClosed = !!closedRestaurants[rid];
  const isAccepting = acceptingOrders[rid] !== false; // default true
  const todaysSales = partnerOrders.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total, 0) + 412.5;
  const active = partnerOrders.filter((o) => ["ACCEPTED", "PREPARING", "READY"].includes(o.status)).length;
  const pending = partnerOrders.filter((o) => o.status === "PLACED").length;
  const completed = partnerOrders.filter((o) => o.status === "COMPLETED").length + 28;

  const STATS = [
    { label: "Today's sales", value: formatPrice(todaysSales), delta: "+12.4%", icon: DollarSign, tone: "bg-primary text-primary-foreground" },
    { label: "Active", value: active, delta: "Live", icon: ChefHat, tone: "bg-amber-100 text-amber-700" },
    { label: "Pending", value: pending, delta: "Awaiting accept", icon: BellRing, tone: "bg-sky-100 text-sky-700" },
    { label: "Completed", value: completed, delta: "Today", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="animate-fade-up space-y-7 px-5 pt-7">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Restaurant Partner</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{partnerRestaurant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isClosed ? "Temporarily closed" : isAccepting ? "Open now · accepting orders" : "Open · paused new orders"}</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${isClosed ? "bg-destructive/10 text-destructive" : isAccepting ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
          <span className={`h-2 w-2 animate-pulse-soft rounded-full ${isClosed ? "bg-destructive" : isAccepting ? "bg-primary" : "bg-amber-500"}`} />
          {isClosed ? "Closed" : isAccepting ? "Online" : "Paused"}
        </span>
      </header>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary"><Power className="h-4 w-4" strokeWidth={2.4} /></span>
            <div>
              <p className="text-sm font-bold">Accept new orders</p>
              <p className="text-[11px] text-muted-foreground">Toggle off to pause incoming orders.</p>
            </div>
          </div>
          <Switch checked={isAccepting && !isClosed} disabled={isClosed} onCheckedChange={(v) => setAcceptingOrders(rid, v)} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-100 text-amber-700"><StoreIcon className="h-4 w-4" strokeWidth={2.4} /></span>
            <div>
              <p className="text-sm font-bold">Temporary close</p>
              <p className="text-[11px] text-muted-foreground">Hide your restaurant from customers for now.</p>
            </div>
          </div>
          <Switch checked={isClosed} onCheckedChange={(v) => setRestaurantClosed(rid, v)} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${s.tone}`}>
                <s.icon className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.delta}</span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-[12px] font-medium text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-primary-strong to-primary p-5 text-primary-foreground shadow-pop">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Weekly revenue</p>
        </div>
        <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">{formatPrice(4218.6)}</p>
        <p className="mt-1 text-xs text-white/80">+18.2% vs last week · 132 orders fulfilled</p>
        <div className="mt-4 flex h-16 items-end gap-1.5">
          {[40, 60, 35, 80, 55, 92, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-md bg-white/30" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-white/60">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Live order queue</h2>
          <span className="text-[11px] font-bold text-primary">{partnerOrders.filter(o => o.status !== "COMPLETED").length} open</span>
        </div>
        <div className="space-y-3">
          {partnerOrders.filter(o => o.status !== "COMPLETED").slice(0, 4).map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-[12px] font-extrabold text-primary">
                #{o.id.slice(-3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold">{o.customer}</p>
                <p className="text-[12px] text-muted-foreground">{o.items.length} items · {o.placedAgo} ago</p>
              </div>
              <div className="text-right">
                <p className="font-display text-sm font-extrabold">{formatPrice(o.total)}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h2 className="font-display text-lg font-bold">Top dishes today</h2>
        <ul className="mt-3 space-y-2.5">
          {partnerRestaurant.menu.slice(0, 4).map((d, i) => (
            <li key={d.id} className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[12px] font-bold">{i + 1}</span>
              <span className="flex-1 truncate text-sm font-medium">{d.name}</span>
              <span className="text-[12px] font-bold text-muted-foreground">{42 - i * 8} sold</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-2 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <Clock className="h-4 w-4 text-amber-700" />
        <p className="text-[12px] font-medium text-amber-900">Average prep time today: <span className="font-bold">14 min</span></p>
      </div>
    </div>
  );
}
