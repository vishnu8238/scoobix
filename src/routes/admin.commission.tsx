import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, IndianRupee, Percent, Banknote, TrendingUp } from "lucide-react";
import { commissionBreakdown } from "@/lib/mock-extras";
import { adminStats } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/commission")({
  head: () => ({ meta: [{ title: "Cravio Admin · Revenue & commission" }] }),
  component: CommissionPage,
});

function CommissionPage() {
  const net = commissionBreakdown.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Revenue & commission</h1>
        <p className="text-sm text-muted-foreground">Today · across all restaurants and riders</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Card icon={IndianRupee} label="Gross revenue"   value={formatPrice(adminStats.revenueToday)} growth={adminStats.growth.revenue} />
        <Card icon={Percent}     label="Avg commission"  value="18%" growth={0.4} />
        <Card icon={Banknote}    label="Net to Cravio"   value={formatPrice(net)} growth={11.2} />
        <Card icon={TrendingUp}  label="Orders today"    value={adminStats.ordersToday.toLocaleString("en-IN")} growth={adminStats.growth.orders} />
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
