import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/format";
import { TrendingUp, Package, Clock, Gift, Search, Filter } from "lucide-react";
import { useDriver } from "@/lib/driver-store";
import { useLiveData } from "@/lib/realtime-hooks";
import { fetchRiderEarnings } from "@/lib/rider-api";

export const Route = createFileRoute("/rider/earnings")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Earnings" }] }),
  component: RiderEarnings,
});

const TABS = ["Daily", "Weekly", "Lifetime"] as const;
const DAY = 86400000;

function RiderEarnings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Weekly");
  const { driverId } = useDriver();
  
  const { data, loading } = useLiveData<any[]>(
    ["orders"],
    () => (driverId ? fetchRiderEarnings(driverId) : Promise.resolve([])),
    [driverId]
  );
  
  const earnings = data ?? [];

  const windowMs = tab === "Daily" ? DAY : tab === "Weekly" ? 7 * DAY : Infinity;
  const since = tab !== "Lifetime" ? Date.now() - windowMs : 0;
  
  const filtered = earnings.filter(e => new Date(e.created_at).getTime() >= since);
  
  const dataStats = {
    total: filtered.reduce((s, e) => s + Number(e.amount || 0) + Number(e.tip || 0), 0),
    tips: filtered.reduce((s, e) => s + e.tip, 0),
    deliveries: filtered.length,
  };

  return (
    <div className="w-full min-h-svh pb-8 px-4 pt-7 animate-fade-up">
      <header className="mb-6">
        <p className="eyebrow text-primary">Earnings</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Your payouts</h1>
      </header>

      <div className="flex gap-2 rounded-full bg-muted/50 p-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full py-2 text-[10px] font-black uppercase tracking-widest transition",
              tab === t ? "bg-card text-primary shadow-soft ring-1 ring-border/60" : "text-muted-foreground",
            )}
          >{t}</button>
        ))}
      </div>

      <div className="rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-strong p-6 text-primary-foreground shadow-pop mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{tab} Total</p>
        <p className="mt-2 font-display text-5xl font-extrabold tracking-tight">{formatPrice(dataStats.total)}</p>
        <p className="mt-1 text-xs font-bold text-white/80">incl. {formatPrice(dataStats.tips)} in tips</p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
             <Package className="h-4 w-4 text-white/70 mb-2" />
             <p className="font-display text-xl font-extrabold">{dataStats.deliveries}</p>
             <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Deliveries</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
             <Clock className="h-4 w-4 text-white/70 mb-2" />
             <p className="font-display text-xl font-extrabold">{Math.round(dataStats.deliveries * 0.8)}h</p>
             <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Active Time</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Recent Payouts</h2>
          <button className="text-[10px] font-black uppercase tracking-widest text-primary">View All</button>
        </div>
        
        <ul className="rounded-[2rem] bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
          {loading ? (
             <li className="p-8 text-center text-xs text-muted-foreground">Loading...</li>
          ) : filtered.length === 0 ? (
             <li className="p-8 text-center text-xs text-muted-foreground">No earnings for this period.</li>
          ) : (
            [...filtered].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map((p, i) => (
              <li key={i} className="flex items-center gap-4 p-4 border-b border-border/40 last:border-0 hover:bg-muted/30 transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">Delivery payout</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <p className="font-display text-sm font-black text-primary">+{formatPrice(p.amount + p.tip)}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
