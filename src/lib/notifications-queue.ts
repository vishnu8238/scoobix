/**
 * Notification queue.
 *
 * Notifications are never written one-by-one. Every producer calls
 * `queueNotification(...)`; the queue
 *   1. de-duplicates by a stable key (same user + title + body inside the
 *      dedupe window is dropped),
 *   2. batches everything collected inside a short window into ONE insert,
 *   3. flushes on page hide so nothing is lost,
 *   4. degrades silently — a failed flush is retried once by the CRUD layer.
 *
 * Result: N notification events cost 1 request instead of N.
 */
import { createRecords, invalidateTable } from "./insforge-crud";

export type QueuedNotification = {
  user_id: string;
  title: string;
  message: string;
  kind?: "order" | "promo" | "system";
  /** Optional explicit dedupe key. Defaults to user+title+message. */
  dedupeKey?: string;
};

/** Batch window — long enough to collapse a burst, short enough to feel live. */
const FLUSH_MS = 1500;
/** Max rows per insert. */
const MAX_BATCH = 50;
/** How long a given notification stays "already sent" (ms). */
const DEDUPE_TTL = 10 * 60 * 1000;

const DEDUPE_STORE = "sx:notif:sent";

let pending: QueuedNotification[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let sent = new Map<string, number>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof localStorage === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(DEDUPE_STORE);
    if (raw) sent = new Map(Object.entries(JSON.parse(raw) as Record<string, number>));
  } catch {
    /* ignore */
  }
}

function persistDedupe() {
  if (typeof localStorage === "undefined") return;
  const cutoff = Date.now() - DEDUPE_TTL;
  for (const [k, at] of Array.from(sent)) if (at < cutoff) sent.delete(k);
  try {
    localStorage.setItem(DEDUPE_STORE, JSON.stringify(Object.fromEntries(sent)));
  } catch {
    /* ignore */
  }
}

function keyOf(n: QueuedNotification) {
  return n.dedupeKey ?? `${n.user_id}|${n.title}|${n.message}`;
}

/** True when this notification was already queued/sent inside the window. */
export function isDuplicateNotification(n: QueuedNotification): boolean {
  hydrate();
  const at = sent.get(keyOf(n));
  return typeof at === "number" && Date.now() - at < DEDUPE_TTL;
}

/** Queue one notification. Returns false when dropped as a duplicate. */
export function queueNotification(n: QueuedNotification): boolean {
  hydrate();
  if (!n.user_id || (!n.title && !n.message)) return false;
  if (isDuplicateNotification(n)) return false;
  sent.set(keyOf(n), Date.now());
  pending.push(n);
  if (pending.length >= MAX_BATCH) {
    void flushNotifications();
  } else if (!timer) {
    timer = setTimeout(() => void flushNotifications(), FLUSH_MS);
  }
  return true;
}

/** Queue many at once (e.g. a campaign broadcast). */
export function queueNotifications(list: QueuedNotification[]): number {
  return list.reduce((n, item) => n + (queueNotification(item) ? 1 : 0), 0);
}

/** Write everything pending in a single batched insert. Never throws. */
export async function flushNotifications(): Promise<number> {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (!pending.length) return 0;
  const batch = pending.slice(0, MAX_BATCH);
  pending = pending.slice(MAX_BATCH);
  const rows = batch.map((n) => ({
    user_id: n.user_id,
    title: n.title,
    message: n.message,
    kind: n.kind ?? "system",
  }));
  await createRecords("notifications", rows);
  invalidateTable("notifications");
  persistDedupe();
  if (pending.length) timer = setTimeout(() => void flushNotifications(), FLUSH_MS);
  return rows.length;
}

export function pendingNotificationCount() {
  return pending.length;
}

/** Drop rows that duplicate an earlier one — used when rendering a feed. */
export function dedupeNotificationRows<T extends { title?: string; body?: string; message?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.title ?? ""}|${r.body ?? r.message ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushNotifications();
  });
  window.addEventListener("pagehide", () => void flushNotifications());
}
