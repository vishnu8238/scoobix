import { createFileRoute } from "@tanstack/react-router";
import { appHead, APPS } from "@/lib/apps";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/logistics/gigs")({
  head: () => appHead(APPS.logistics),
  component: LogisticsGigs,
});

function LogisticsGigs() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Inventory</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Gig Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage service gigs and task inventory.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 bg-card rounded-3xl ring-1 ring-border/60">
        <Sparkles className="h-12 w-12 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">Gig Board</p>
        <p className="text-sm mt-1">No active logistics gigs found in your assigned zones.</p>
      </div>
    </div>
  );
}
