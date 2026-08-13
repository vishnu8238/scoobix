import { createFileRoute } from "@tanstack/react-router";
import { ZoneManager } from "@/components/admin/ZoneManager";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Delivery Zones" }] }),
  component: ZonesPage,
});

function ZonesPage() {
  return (
    <div className="fixed inset-0 md:left-64 p-0">
      <ZoneManager />
    </div>
  );
}
