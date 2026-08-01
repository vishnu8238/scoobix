import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications-store";
import { NotificationItem } from "./app.notifications";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/rider/notifications")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Notifications" }] }),
  component: RiderNotifs,
});

function RiderNotifs() {
  const { list, markRead, markAllRead, unreadCount } = useNotifications("rider");
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Notifications" subtitle={unreadCount ? `${unreadCount} unread` : "Trips, payouts & bonuses"} />
      {unreadCount > 0 && (
        <div className="mt-3 flex justify-end px-4">
          <button onClick={markAllRead} className="text-[12px] font-bold text-primary">Mark all as read</button>
        </div>
      )}
      {list.length === 0 ? (
        <div className="px-4 pt-6"><EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="You're all caught up." /></div>
      ) : (
        <ul className="mt-4 space-y-2 px-4">
          {list.map((n) => (
            <li key={n.id} onClick={() => n.unread && markRead(n.id)}><NotificationItem n={n} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
