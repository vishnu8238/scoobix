import { createFileRoute } from "@tanstack/react-router";
import { ZoneManager } from "@/components/admin/ZoneManager";

export const Route = createFileRoute("/logistics/zones")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Delivery Zones" }] }),
  component: LogisticsZones,
});

function LogisticsZones() {
  return (
    <div className="fixed inset-0 md:left-64 p-0">
      <ZoneManager />
    </div>
  );
}

