import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { 
  IndianRupee, 
  Search, 
  Filter, 
  Calendar, 
  ChevronRight, 
  Plus, 
  ArrowRight,
  Download,
  AlertCircle,
  FileText,
  Clock
} from "lucide-react";
import { useLiveTable } from "@/lib/realtime-hooks";
import { PayoutPeriod, getPayoutPeriods } from "@/lib/payouts-api";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useSuspenseQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/logistics/payouts")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Driver Payouts" }] }),
  component: LogisticsPayouts,
});

function LogisticsPayouts() {
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: payouts } = useSuspenseQuery({
    queryKey: ["logistics", "payouts", filter],
    queryFn: () => getPayoutPeriods()
  });

  const stats = useMemo(() => {
    const active = payouts.filter(p => p.status !== 'VOID');
    return {
      gross: active.reduce((s, p) => s + Number(p.gross_earnings), 0),
      deductions: active.reduce((s, p) => s + Number(p.total_deductions), 0),
      net: active.reduce((s, p) => s + Number(p.net_payable), 0),
      settled: active.filter(p => p.status === 'SETTLED').reduce((s, p) => s + Number(p.net_payable), 0),
    };
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    let result = payouts;

    if (filter === "week") {
      const start = startOfWeek(new Date());
      const end = endOfWeek(new Date());
      result = result.filter(p => isWithinInterval(new Date(p.created_at), { start, end }));
    } else if (filter === "last7") {
      const start = subDays(new Date(), 7);
      result = result.filter(p => new Date(p.created_at) >= start);
    }

    if (searchQuery) {
      result = result.filter(p => p.driver_id.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return result;
  }, [payouts, filter, searchQuery]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">FinOps</p>
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight">Driver Payouts</h1>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-sm ring-1 ring-border transition hover:bg-muted active:scale-95">
            <Download className="h-4 w-4" /> Export Report
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition hover:opacity-90 active:scale-95">
            <Plus className="h-4 w-4" /> Create Statement
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross Earnings" value={stats.gross} icon={IndianRupee} tone="primary" />
        <StatCard label="Total Deductions" value={stats.deductions} icon={AlertCircle} tone="danger" />
        <StatCard label="Net Payable" value={stats.net} icon={IndianRupee} tone="success" />
        <StatCard label="Total Settled" value={stats.settled} icon={FileText} tone="muted" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-card/60 p-4 backdrop-blur-sm ring-1 ring-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="All Activity" />
          <FilterButton active={filter === "week"} onClick={() => setFilter("week")} label="This Week" />
          <FilterButton active={filter === "last7"} onClick={() => setFilter("last7")} label="Last 7 Days" />
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search driver ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-2xl bg-background pl-11 pr-4 text-sm font-medium outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <section className="rounded-[2.5rem] bg-card shadow-card ring-1 ring-border/60 overflow-hidden">
        <DataTable
          columns={["Period", "Driver", "Gross", "Net", "Status", ""]}
          rows={filteredPayouts.map((p) => [
            <div key={p.id+"p"} className="flex flex-col">
              <span className="text-sm font-black">{format(new Date(p.period_start), "MMM d")} - {format(new Date(p.period_end), "MMM d, yyyy")}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{p.id.slice(0, 8)}</span>
            </div>,
            <span key={p.id+"d"} className="font-bold text-primary">{p.driver_id.slice(0, 8)}</span>,
            <span key={p.id+"g"} className="font-medium text-muted-foreground">{formatPrice(Number(p.gross_earnings))}</span>,
            <span key={p.id+"n"} className="font-display font-black text-lg">{formatPrice(Number(p.net_payable))}</span>,
            <StatusBadge key={p.id+"s"} label={p.status} />,
            <button key={p.id+"v"} className="group flex h-9 w-9 items-center justify-center rounded-full bg-muted transition hover:bg-primary hover:text-primary-foreground active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          ])}
        />
        {filteredPayouts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Clock className="h-8 w-8 text-muted-foreground opacity-40" />
            </div>
            <p className="font-display text-xl font-bold">No payouts found</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Only completed and delivered work generates eligible payout earnings.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary-soft",
    danger: "text-rose-600 bg-rose-50",
    success: "text-emerald-600 bg-emerald-50",
    muted: "text-muted-foreground bg-muted",
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 transition hover:shadow-card">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-black tracking-tight">{formatPrice(value)}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
        active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
