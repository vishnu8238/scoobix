import { createFileRoute } from "@tanstack/react-router";
import { appHead, APPS } from "@/lib/apps";
import { Map } from "lucide-react";

export const Route = createFileRoute("/logistics/subzones")({
  head: () => appHead(APPS.logistics),
  component: LogisticsSubzones,
});

function LogisticsSubzones() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Geography</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Subzones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Detailed territory management.</p>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 bg-card rounded-3xl ring-1 ring-border/60">
        <Map className="h-12 w-12 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">Subzone Management</p>
        <p className="text-sm mt-1">Detailed subzone overlays are loading...</p>
      </div>
    </div>
  );
}
