import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Clock, Loader2, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/logistics/analytics")({
  component: LogisticsAnalytics,
});

function LogisticsAnalytics() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Logistics Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance metrics and operational efficiency data.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Avg. Pickup Time" value="12.4m" trend="+2%" icon={Clock} />
            <MetricCard label="Avg. Delivery Time" value="28.1m" trend="-5%" icon={TrendingUp} tone="emerald" />
            <MetricCard label="Fleet Utilization" value="84%" trend="+12%" icon={Users} tone="primary" />
            <MetricCard label="Success Rate" value="99.2%" trend="Stable" icon={ArrowUpRight} tone="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 min-h-[300px]">
              <h3 className="font-display text-lg font-extrabold mb-4">Daily Order Volume</h3>
              <div className="h-48 w-full bg-muted/30 rounded-2xl flex items-center justify-center italic text-muted-foreground text-sm">
                Chart Visualization Placeholder
              </div>
            </div>
            <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60 min-h-[300px]">
              <h3 className="font-display text-lg font-extrabold mb-4">Rider Efficiency by Zone</h3>
              <div className="h-48 w-full bg-muted/30 rounded-2xl flex items-center justify-center italic text-muted-foreground text-sm">
                Map Density Heatmap Placeholder
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, trend, icon: Icon, tone = "amber" }: any) {
  const tones: any = {
    primary: "bg-sky-50 text-sky-600 ring-sky-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
  };
  return (
    <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-display font-extrabold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="text-[10px] font-extrabold text-emerald-600">{trend}</span>
      </div>
    </div>
  );
}
