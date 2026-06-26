import { createFileRoute } from "@tanstack/react-router";
import { Bell, Sparkles, ClipboardList, BellRing } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { customerNotifications, partnerNotifications, riderNotifications, type AppNotification } from "@/lib/mock-extras";
import { useState } from "react";
import { cn } from "@/lib/format";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Cravio · Notifications" }] }),
  component: NotificationsPage,
});

const ICONS = {
  order: ClipboardList,
  promo: Sparkles,
  system: BellRing,
};

function NotificationsPage() {
  const [tab, setTab] = useState<"all" | "orders" | "offers">("all");
  const all = [...customerNotifications, ...partnerNotifications.slice(0, 1), ...riderNotifications.slice(0, 1)];
  const list = customerNotifications;
  const filtered = tab === "all" ? list : list.filter((n) => (tab === "orders" ? n.kind === "order" : n.kind === "promo"));
  void all;

  return (
    <div className="min-h-svh pb-16">
      <PageHeader title="Notifications" subtitle={`${list.filter((n) => n.unread).length} unread`} />

      <div className="mx-4 mt-3 grid grid-cols-3 rounded-full bg-secondary p-1">
        {(["all", "orders", "offers"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full py-2 text-[12px] font-bold capitalize transition", tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Bell className="h-9 w-9" />} title="All caught up" description="You'll see updates about your orders and offers here." />
      ) : (
        <ul className="mt-4 space-y-2 px-4">
          {filtered.map((n) => <NotificationItem key={n.id} n={n} />)}
        </ul>
      )}
    </div>
  );
}

export function NotificationItem({ n }: { n: AppNotification }) {
  const Icon = ICONS[n.kind];
  const tone = n.kind === "order" ? "bg-primary-soft text-primary" : n.kind === "promo" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700";
  return (
    <li className={cn("flex gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60 transition", n.unread && "ring-primary/30")}>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tone)}><Icon className="h-5 w-5" strokeWidth={2.4} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-sm font-bold">{n.title}</h4>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{n.ago}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{n.body}</p>
      </div>
      {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </li>
  );
}
