import { createFileRoute } from "@tanstack/react-router";
import { appHead, APPS } from "@/lib/apps";
import { Navigation } from "lucide-react";

export const Route = createFileRoute("/logistics/dispatch")({
  head: () => appHead(APPS.logistics),
  component: LogisticsDispatch,
});

function LogisticsDispatch() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Logistics Ops</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Manual Dispatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assign orders to delivery partners manually.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 bg-card rounded-3xl ring-1 ring-border/60">
        <Navigation className="h-12 w-12 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">Dispatch Center Ready</p>
        <p className="text-sm mt-1">Select an order from the feed to begin manual assignment.</p>
      </div>
    </div>
  );
}
