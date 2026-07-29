import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { listTable, deleteRecord } from "@/lib/insforge-crud";

type Row = { id: string; title?: string | null; message?: string | null; created_at?: string | null };

export const Route = createFileRoute("/manager/notifications")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Notifications" },
      { name: "description", content: "Admin approval and rejection alerts for your restaurants." },
    ],
  }),
  component: ManagerNotifications,
});

function ManagerNotifications() {
  const { user } = useAuth();
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) { setList([]); setLoading(false); return; }
      const rows = await listTable<Row>("notifications", {
        user_id: `eq.${user.id}`,
        order: "created_at.desc",
        limit: 100,
      });
      if (!cancelled) { setList(rows); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const dismiss = (id: string) => {
    setList((p) => p.filter((n) => n.id !== id));
    void deleteRecord("notifications", id);
  };

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="Notifications" />
      <div className="px-5 pt-4 space-y-2.5">
        {loading && <div className="h-20 animate-pulse rounded-3xl bg-muted/60" />}
        {!loading && list.length === 0 && (
          <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
            <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">You're all caught up</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Admin decisions on your restaurants will land here.
            </p>
          </div>
        )}
        {list.map((n) => (
          <button
            key={n.id}
            onClick={() => dismiss(n.id)}
            className="w-full rounded-3xl bg-card p-4 text-left shadow-soft ring-1 ring-border/60"
          >
            <p className="text-sm font-bold">{n.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{n.message}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
