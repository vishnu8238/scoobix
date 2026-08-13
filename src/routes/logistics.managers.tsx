import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, Target, Store, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listManagers, listManagerRestaurants, managerStats, type MerchantManager } from "@/lib/manager-api";

export const Route = createFileRoute("/logistics/managers")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Managers" }] }),
  component: LogisticsManagers,
});

function LogisticsManagers() {
  const [managers, setManagers] = useState<MerchantManager[]>([]);
  const [perf, setPerf] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await listManagers();
    setManagers(rows);
    const entries = await Promise.all(rows.map(async m => [m.id, await listManagerRestaurants(m.id)] as const));
    setPerf(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6 text-left">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Merchant Managers</h1>
        <p className="text-sm text-muted-foreground">Monitor performance and restaurant onboarding.</p>
      </header>

      {loading ? <div className="h-40 animate-pulse rounded-3xl bg-muted/60" /> : (
        <div className="space-y-4">
          {managers.map((m) => {
            const stats = managerStats(perf[m.id] || [], m.monthly_target || 10);
            return (
              <section key={m.id} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
                <div className="flex justify-between items-center mb-4">
                  <div><p className="font-display text-lg font-extrabold">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">{m.status}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <Metric label="Live" value={stats.live} />
                   <Metric label="Pending" value={stats.pending} />
                   <Metric label="Target" value={`${stats.thisMonth}/${stats.target}`} />
                   <Metric label="Efficiency" value={`${Math.round((stats.live / Math.max(stats.onboarded, 1)) * 100)}%`} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string, value: any }) {
  return (
    <div className="p-3 bg-muted/30 rounded-2xl text-center">
       <p className="text-xl font-black">{value}</p>
       <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
