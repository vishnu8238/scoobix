import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, IndianRupee, Percent, Banknote, TrendingUp, Search, Save, Calculator } from "lucide-react";
import { toast } from "sonner";
import { commissionBreakdown } from "@/lib/mock-extras";
import { adminStats, adminRestaurants } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { useCms } from "@/lib/cms-store";

export const Route = createFileRoute("/admin/commission")({
  head: () => ({ meta: [{ title: "Cravio Admin · Revenue & commission" }] }),
  component: CommissionPage,
});

function CommissionPage() {
  const net = commissionBreakdown.reduce((s, x) => s + x.value, 0);
  const { commissions } = useCms();
  const avg = useMemo(() => {
    const vals = Object.values(commissions);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [commissions]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Revenue & commission</h1>
        <p className="text-sm text-muted-foreground">Today · across all restaurants and riders</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Card icon={IndianRupee} label="Gross revenue"   value={formatPrice(adminStats.revenueToday)} growth={adminStats.growth.revenue} />
        <Card icon={Percent}     label="Avg commission"  value={`${avg}%`} growth={0.4} />
        <Card icon={Banknote}    label="Net to Cravio"   value={formatPrice(net)} growth={11.2} />
        <Card icon={TrendingUp}  label="Orders today"    value={adminStats.ordersToday.toLocaleString("en-IN")} growth={adminStats.growth.orders} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RestaurantCommissionTable />
        <CommissionCalculator />
      </div>

      <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <h3 className="font-display text-lg font-bold">Breakdown</h3>
        <ul className="mt-4 divide-y divide-border/60">
          {commissionBreakdown.map((c) => (
            <li key={c.label} className="flex items-center justify-between py-3.5">
              <span className="text-sm">{c.label}</span>
              <span className={`font-display text-base font-bold ${c.value < 0 ? "text-destructive" : "text-foreground"}`}>
                {c.value < 0 ? `- ${formatPrice(Math.abs(c.value))}` : formatPrice(c.value)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between pt-4">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Net commission</span>
            <span className="font-display text-2xl font-extrabold text-primary">{formatPrice(net)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, growth }: { icon: any; label: string; value: string; growth: number }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-5 w-5" strokeWidth={2.5} /></span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight className="h-3 w-3" />{growth}%</span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RESTAURANT COMMISSION TABLE                                         */
/* ------------------------------------------------------------------ */

function RestaurantCommissionTable() {
  const { commissions, setCommission } = useCms();
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = adminRestaurants.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  const save = (id: string) => {
    const v = Number(drafts[id]);
    if (Number.isNaN(v) || v < 0 || v > 100) {
      toast.error("Commission must be between 0 and 100%");
      return;
    }
    setCommission(id, v);
    setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    toast.success(`Commission updated to ${v}%`);
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">Restaurant commissions</h3>
          <p className="text-xs text-muted-foreground">{rows.length} restaurants · changes save instantly</p>
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search restaurants…"
            className="h-9 w-full rounded-xl bg-muted/40 pl-9 pr-3 text-sm font-medium outline-none ring-1 ring-border/60 transition focus:bg-background focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const saved = commissions[r.id] ?? 15;
          const draft = drafts[r.id];
          const dirty = draft !== undefined && Number(draft) !== saved;
          return (
            <li key={r.id} className="flex items-center gap-3 py-3.5">
              <img src={r.image} alt="" className="h-11 w-11 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{r.cuisine} · {r.orders} orders</p>
              </div>

              <div className="flex items-center gap-1.5 rounded-2xl bg-muted/50 px-2 py-1.5 ring-1 ring-border/60 focus-within:bg-background focus-within:ring-primary/40">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft ?? String(saved)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  className="w-14 bg-transparent text-right font-display text-base font-extrabold tabular-nums outline-none"
                />
                <Percent className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              <button
                onClick={() => save(r.id)}
                disabled={!dirty}
                className="flex h-9 items-center gap-1.5 rounded-2xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">No restaurants match "{query}"</li>
        )}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* COMMISSION CALCULATOR                                               */
/* ------------------------------------------------------------------ */

function CommissionCalculator() {
  const { commissions } = useCms();
  const restaurantOptions = adminRestaurants;
  const [restaurantId, setRestaurantId] = useState<string>(restaurantOptions[0].id);
  const [amount, setAmount] = useState<number>(500);

  const pct = commissions[restaurantId] ?? 15;
  const earning = Math.round(amount * (pct / 100));
  const payout = amount - earning;
  const selected = restaurantOptions.find((r) => r.id === restaurantId);

  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
          <Calculator className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">Commission calculator</h3>
          <p className="text-[11px] text-muted-foreground">Live preview</p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Restaurant</span>
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="h-10 w-full rounded-xl bg-background px-3 text-sm font-medium outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
        >
          {restaurantOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Order amount</span>
        <div className="flex items-center gap-2 rounded-xl bg-background px-3 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-primary/40">
          <span className="text-base font-bold text-muted-foreground">₹</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="h-10 flex-1 bg-transparent font-display text-lg font-extrabold tabular-nums outline-none"
          />
        </div>
      </label>

      <div className="mt-5 space-y-2">
        <Row label="Order amount" value={formatPrice(amount)} />
        <Row label={`Commission (${pct}%)`} value={`− ${formatPrice(earning)}`} muted />
        <div className="my-2 border-t border-dashed border-border" />
        <Row label="Restaurant payout" value={formatPrice(payout)} muted />
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-glow">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground/80">Platform earning</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{formatPrice(earning)}</p>
          {selected && <p className="mt-0.5 text-[11px] text-primary-foreground/85">From {selected.name}</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{label}</span>
      <span className={`font-display font-bold tabular-nums ${muted ? "text-muted-foreground" : ""}`}>{value}</span>
    </div>
  );
}
