import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useNotifications } from "@/lib/notifications-store";
import { NotificationItem } from "./app.notifications";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/rider/notifications")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Notifications" }] }),
  component: RiderNotifs,
});

function RiderNotifs() {
  const { list } = useNotifications("rider");
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Notifications" subtitle="Trips, payouts & bonuses" />
      {list.length === 0 ? (
        <div className="px-4 pt-6"><EmptyState title="No notifications" description="You're all caught up." /></div>
      ) : (
        <ul className="mt-4 space-y-2 px-4">
          {list.map((n) => <NotificationItem key={n.id} n={n} />)}
        </ul>
      )}
    </div>
  );
}
