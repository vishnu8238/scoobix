import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/format";
import { TrendingUp, Package, Clock, Gift } from "lucide-react";
import { useDriver } from "@/lib/driver-store";
import { useLiveOrders } from "@/lib/realtime-hooks";

export const Route = createFileRoute("/rider/earnings")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Earnings" }] }),
  component: RiderEarnings,
});

const TABS = ["Daily", "Weekly", "Monthly"] as const;
const DAY = 86400000;

type DeliveredOrder = {
  driver_earnings?: number | null;
  tip?: number | null;
  status?: string | null;
  finalized_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function RiderEarnings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Weekly");
  const { driverId } = useDriver();
  const { rows } = useLiveOrders(driverId ? { driver_id: driverId } : undefined);

  const delivered = (rows as DeliveredOrder[])
    .filter((o) => String(o.status ?? "").toUpperCase() === "DELIVERED")
    .map((o) => ({
      at: new Date(o.finalized_at ?? o.updated_at ?? o.created_at ?? Date.now()).getTime(),
      amount: Number(o.driver_earnings ?? 0),
      tip: Number(o.tip ?? 0),
    }));

  const windowMs = tab === "Daily" ? DAY : tab === "Weekly" ? 7 * DAY : 30 * DAY;
  const since = Date.now() - windowMs;
  const inWindow = delivered.filter((d) => d.at >= since);
  const data = {
    total: inWindow.reduce((s, d) => s + d.amount + d.tip, 0),
    tips: inWindow.reduce((s, d) => s + d.tip, 0),
    deliveries: inWindow.length,
    hours: Math.round((inWindow.length * 0.6) * 10) / 10,
  };

  const history = Array.from({ length: 7 }).map((_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (6 - i));
    const dayEnd = dayStart.getTime() + DAY;
    return {
      day: ["S", "M", "T", "W", "T", "F", "S"][dayStart.getDay()],
      amount: delivered
        .filter((d) => d.at >= dayStart.getTime() && d.at < dayEnd)
        .reduce((s, d) => s + d.amount + d.tip, 0),
    };
  });
  const e = { history };
  const max = Math.max(1, ...history.map((d) => d.amount));


  return (
    <div className="animate-fade-up space-y-6 px-5 pt-7">
      <header>
        <p className="eyebrow">Earnings</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Your payouts</h1>
      </header>

      <div className="flex gap-2 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-[12px] font-bold transition",
              tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >{t}</button>
        ))}
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-strong p-6 text-primary-foreground shadow-pop">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{tab} total</p>
        <p className="mt-2 font-display text-5xl font-extrabold tracking-tight">{formatPrice(data.total)}</p>
        <p className="mt-1 text-xs text-white/80">incl. {formatPrice(data.tips)} in tips</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <MiniStat icon={Package} label="Deliveries" value={String(data.deliveries)} />
          <MiniStat icon={Clock} label="Hours online" value={`${data.hours}h`} />
        </div>
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h2 className="font-display text-lg font-bold">Last 7 days</h2>
        <div className="mt-4 flex h-32 items-end gap-2">
          {e.history.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full flex-1 items-end">
                <div className="w-full rounded-t-lg bg-primary/15" style={{ height: `${(d.amount / max) * 100}%` }} />
                <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-primary transition-all" style={{ height: `${(d.amount / max) * 70}%` }} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h2 className="font-display text-lg font-bold">Recent payouts</h2>
        <ul className="mt-3 space-y-3">
          {[
            { date: "Today · 3:24 PM", from: "Scoobix weekly payout", amount: 612.4 },
            { date: "Last Mon · 9:01 AM", from: "Scoobix weekly payout", amount: 488.1 },
            { date: "2 weeks ago", from: "Scoobix weekly payout", amount: 552.7 },
          ].map((p, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">{p.from}</p>
                <p className="text-[11px] text-muted-foreground">{p.date}</p>
              </div>
              <span className="font-display text-sm font-extrabold text-primary">+{formatPrice(p.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <Gift className="h-5 w-5 text-amber-700" />
        <p className="text-xs font-medium text-amber-900">Complete <span className="font-bold">3 more trips</span> today to unlock a <span className="font-bold">₹1,250 bonus</span>.</p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
      <Icon className="h-4 w-4" />
      <p className="mt-1.5 font-display text-lg font-extrabold">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</p>
    </div>
  );
}
