/**
 * Notifications — live-fetched from the InsForge `notifications` table.
 * No mock fallback: an empty table renders the screen's empty state.
 */
import { useEffect, useState } from "react";
import { listTable, deleteRecord } from "./insforge-crud";
import { useAuth } from "./auth-store";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  ago: string;
  kind: "order" | "promo" | "system";
  unread?: boolean;
};

type NotifRow = {
  id?: string;
  title?: string;
  body?: string;
  message?: string;
  ago?: string;
  kind?: AppNotification["kind"];
  unread?: boolean;
  audience?: "customer" | "partner" | "rider" | string;
  user_id?: string;
  created_at?: string;
};

function relativeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr`;
  return `${Math.round(hrs / 24)} d`;
}

const rowToNotif = (r: NotifRow): AppNotification => ({
  id: r.id ?? Math.random().toString(36).slice(2),
  title: r.title ?? "",
  body: r.body ?? r.message ?? "",
  ago: r.ago ?? relativeAgo(r.created_at),
  kind: (r.kind ?? "system") as AppNotification["kind"],
  unread: !!r.unread,
});

export function useNotifications(audience: "customer" | "partner" | "rider") {
  const { user } = useAuth();
  const userId = user?.id;
  const [list, setList] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // The notifications table is per-user (id, user_id, title, message,
      // created_at) — there is no audience column, so scope by the signed-in
      // user and show nothing when signed out.
      if (!userId) {
        if (!cancelled) { setList([]); setStatus("empty"); }
        return;
      }
      const rows = await listTable<NotifRow>("notifications", {
        user_id: `eq.${userId}`,
        order: "created_at.desc",
        limit: 100,
      });
      if (cancelled) return;
      setList(rows.map(rowToNotif));
      setStatus(rows.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
  }, [audience, userId]);

  const markRead = (id: string) => {
    setList((p) => p.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };
  const dismiss = (id: string) => {
    setList((p) => p.filter((n) => n.id !== id));
    void deleteRecord("notifications", id);
  };


  return { list, status, markRead, dismiss };
}
