import { createFileRoute } from "@tanstack/react-router";
import { ZoneManager } from "@/components/admin/ZoneManager";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Delivery Zones" }] }),
  component: ZonesPage,
});

function ZonesPage() {
  return (
    <div className="space-y-6">
      <ZoneManager />
    </div>
  );
}
