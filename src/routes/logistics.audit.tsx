import { createFileRoute } from "@tanstack/react-router";
import { appHead, APPS } from "@/lib/apps";
import { History } from "lucide-react";

export const Route = createFileRoute("/logistics/audit")({
  head: () => appHead(APPS.logistics),
  component: LogisticsAuditLogs,
});

function LogisticsAuditLogs() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">System Logs</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Logistics-specific operational logs and system events.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 bg-card rounded-3xl ring-1 ring-border/60">
        <History className="h-12 w-12 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">Audit log integration pending</p>
        <p className="text-sm mt-1">Operational logs for this portal are being isolated.</p>
      </div>
    </div>
  );
}
