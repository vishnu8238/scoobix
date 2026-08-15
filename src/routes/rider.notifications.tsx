import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Bell, Sparkles, ClipboardList, BellRing, CheckCircle2 } from "lucide-react";
import { useNotifications } from "@/lib/notifications-store";
import { NotificationItem } from "./app.notifications";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useState } from "react";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/rider/notifications")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Notifications" }] }),
  component: RiderNotifs,
});

function RiderNotifs() {
  const [tab, setTab] = useState<"all" | "bonus" | "info" | "offers">("all");
  const { list, markRead, markAllRead, unreadCount } = useNotifications("rider");
  
  const filtered = list.filter(n => {
    if (tab === "all") return true;
    if (tab === "bonus") return n.title.toLowerCase().includes("bonus") || n.title.toLowerCase().includes("incentive");
    if (tab === "offers") return n.kind === "order" || n.title.toLowerCase().includes("offer");
    return n.kind === "system" || n.kind === "promo";
  });

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Notifications" subtitle={unreadCount ? `${unreadCount} unread` : "Trips, payouts & bonuses"} />
      
      {/* Stories / Announcements */}
      <section className="mt-4 px-4">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar py-2">
          <StoryItem label="Bonuses" active />
          <StoryItem label="Safety" />
          <StoryItem label="Tips" />
          <StoryItem label="App Help" />
        </div>
      </section>

      <div className="mx-4 mt-6 flex items-center justify-between">
        <div className="flex gap-2 rounded-full bg-muted/50 p-1">
          {(["all", "bonus", "info", "offers"] as const).map((t) => (
            <button 
              key={t} 
              onClick={() => setTab(t)} 
              className={cn(
                "rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition", 
                tab === t ? "bg-card text-primary shadow-soft ring-1 ring-border/60" : "text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {unreadCount > 0 && (
        <div className="mt-4 flex justify-end px-4">
          <button 
            onClick={markAllRead} 
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary"
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark all read
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="px-4 pt-12">
          <EmptyState 
            icon={<Bell className="h-8 w-8 text-muted-foreground/40" />} 
            title="No notifications" 
            description="You're all caught up with your updates." 
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3 px-4">
          {filtered.map((n) => (
            <li key={n.id} onClick={() => n.unread && markRead(n.id)}>
              <NotificationItem n={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoryItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button className="flex flex-col items-center gap-2 shrink-0 transition active:scale-95">
      <div className={cn(
        "h-16 w-16 rounded-full p-0.5 ring-2 transition",
        active ? "ring-primary shadow-glow" : "ring-border/60"
      )}>
        <div className="h-full w-full rounded-full bg-muted/40 ring-2 ring-background overflow-hidden flex items-center justify-center">
           <Sparkles className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground/40")} />
        </div>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </button>
  );
}
