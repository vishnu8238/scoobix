/**
 * Notifications — live-fetched from InsForge `notifications` table.
 * Falls back to the shared mock arrays when the table is empty so the UI
 * always has something to render on first boot.
 */
import { useEffect, useState } from "react";
import { customerNotifications, partnerNotifications, riderNotifications, type AppNotification } from "./mock-extras";
import { listTable, patchRecord, deleteRecord } from "./insforge-crud";

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

const rowToNotif = (r: NotifRow): AppNotification => ({
  id: r.id ?? Math.random().toString(36).slice(2),
  title: r.title ?? "",
  body: r.body ?? "",
  ago: r.ago ?? "",
  kind: (r.kind ?? "system") as AppNotification["kind"],
  unread: !!r.unread,
});

export function useNotifications(audience: "customer" | "partner" | "rider") {
  const seed = audience === "customer" ? customerNotifications : audience === "partner" ? partnerNotifications : riderNotifications;
  const [list, setList] = useState<AppNotification[]>(seed);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listTable<NotifRow>("notifications", { audience });
      if (cancelled) return;
      if (rows.length) {
        setList(rows.map(rowToNotif));
        setStatus("ready");
      } else {
        setStatus("empty");
      }
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
