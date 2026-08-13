import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, GitMerge, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/format";
import {
  listDuplicateChecks,
  duplicateStats,
  LEVEL_LABEL,
  LEVEL_TONE,
  type DuplicateCheckRow,
} from "@/lib/duplicate-api";

export const Route = createFileRoute("/logistics/duplicates")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Duplicates" }] }),
  component: LogisticsDuplicates,
});

function LogisticsDuplicates() {
  const [rows, setRows] = useState<DuplicateCheckRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const checks = await listDuplicateChecks({ limit: 300 });
    setRows(checks);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const alerts = useMemo(() => rows.filter((r) => r.level === "exact" || r.level === "possible"), [rows]);

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Duplicate management</h1>
          <p className="text-sm text-muted-foreground">Review and flag potential duplicate restaurant entities.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void refresh()}>
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </header>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted/60" />
      ) : alerts.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
          No duplicates detected.
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map((r) => (
            <div key={r.id} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
               <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-bold">{(r.candidate as any)?.name || "Unknown"}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", LEVEL_TONE[(r.level as "exact") ?? "possible"])}>
                    {LEVEL_LABEL[(r.level as "exact") ?? "possible"]}
                  </span>
               </div>
               <p className="mt-1 text-xs text-muted-foreground">Attempted by {r.attempted_by_name} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
