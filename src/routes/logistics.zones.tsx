import { createFileRoute } from "@tanstack/react-router";
import { appHead, APPS } from "@/lib/apps";
import { Map } from "lucide-react";

export const Route = createFileRoute("/logistics/zones")({
  head: () => appHead(APPS.logistics),
  component: LogisticsZones,
});

function LogisticsZones() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Geography</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Delivery Zones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational zone configurations and boundaries.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 bg-card rounded-3xl ring-1 ring-border/60">
        <Map className="h-12 w-12 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">Zone Configuration</p>
        <p className="text-sm mt-1">Zone editing is restricted to Master Admin. Logistics managers can view boundaries.</p>
      </div>
    </div>
  );
}
