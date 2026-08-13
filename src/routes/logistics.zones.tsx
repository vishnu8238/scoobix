import { createFileRoute } from "@tanstack/react-router";
import { ZoneManager } from "@/components/admin/ZoneManager";

export const Route = createFileRoute("/logistics/zones")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Delivery Zones" }] }),
  component: LogisticsZones,
});

function LogisticsZones() {
  return (
    <div className="space-y-6">
      <ZoneManager />
    </div>
  );
}

