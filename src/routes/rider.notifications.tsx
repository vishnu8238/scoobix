import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { riderNotifications } from "@/lib/mock-extras";
import { NotificationItem } from "./app.notifications";

export const Route = createFileRoute("/rider/notifications")({
  head: () => ({ meta: [{ title: "Cravio Rider · Notifications" }] }),
  component: RiderNotifs,
});

function RiderNotifs() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Notifications" subtitle="Trips, payouts & bonuses" />
      <ul className="mt-4 space-y-2 px-4">
        {riderNotifications.map((n) => <NotificationItem key={n.id} n={n} />)}
      </ul>
    </div>
  );
}
