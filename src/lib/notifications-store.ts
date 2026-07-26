/**
 * Notifications — live-fetched from the InsForge `notifications` table.
 * No mock fallback: an empty table renders the screen's empty state.
 */
import { useEffect, useState } from "react";
import { listTable, patchRecord, deleteRecord } from "./insforge-crud";

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
  body: r.body ?? "",
  ago: r.ago ?? relativeAgo(r.created_at),
  kind: (r.kind ?? "system") as AppNotification["kind"],
  unread: !!r.unread,
});

export function useNotifications(audience: "customer" | "partner" | "rider") {
  const [list, setList] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // PostgREST equality filter syntax.
      const rows = await listTable<NotifRow>("notifications", { audience: `eq.${audience}` });
      if (cancelled) return;
      setList(rows.map(rowToNotif));
      setStatus(rows.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
  }, [audience]);


  const markRead = (id: string) => {
    setList((p) => p.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    void patchRecord("notifications", id, { unread: false });
  };
  const dismiss = (id: string) => {
    setList((p) => p.filter((n) => n.id !== id));
    void deleteRecord("notifications", id);
  };

  return { list, status, markRead, dismiss };
}
