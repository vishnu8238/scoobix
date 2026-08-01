/**
 * Scoobix realtime bus — InsForge Realtime (Socket.IO pub/sub).
 *
 * One socket per browser tab, shared by every screen. Channels are refcounted
 * so two panels watching the same table share a single subscription, and every
 * message is de-duplicated by `meta.messageId` (a reconnect can redeliver).
 *
 * Event model
 *  - Any write through `insforge-crud` publishes `changed` on `db:<table>`.
 *  - Scoped fan-out channels (`order:<id>`, `user:<id>`, `restaurant:<id>`,
 *    `driver:<id>`, `ticket:<id>`, `manager:<id>`, `admin`) let a screen listen
 *    to exactly one entity instead of a whole table.
 *  - Database triggers can publish to the same channels/events later without
 *    any client change (server `senderType` is simply `system`).
 *
 * Graceful degradation: if the socket never connects (blocked WS, offline,
 * realtime disabled) nothing throws — the adaptive-polling engine in
 * `realtime.ts` keeps its fast intervals and the UI behaves exactly as before.
 */
import { createClient } from "@insforge/sdk";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

export type ChangePayload = {
  table?: string;
  op?: "insert" | "update" | "delete";
  id?: string;
  row?: Record<string, unknown>;
  [k: string]: unknown;
};

type Handler = (payload: ChangePayload) => void;

const EVENT = "changed";

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<void> | null = null;
let connected = false;
let everConnected = false;

const refs = new Map<string, number>();                 // channel → subscriber count
const handlers = new Map<string, Set<Handler>>();       // channel → handlers
const seen = new Map<string, number>();                 // messageId → ts (dedupe)
const stateListeners = new Set<(on: boolean) => void>();
const anyListeners = new Set<Handler>();

const isBrowser = typeof window !== "undefined";

/** Session token, read straight from storage to avoid an import cycle. */
const ACCESS_KEY = "scoobix_if_access_v1";
function sessionToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}

let clientToken: string | null = null;

function getClient() {
  const token = sessionToken();
  // The realtime handshake requires a signed-in user token; rebuild the client
  // when the session changes so the socket re-authenticates as the new user.
  if (client && clientToken !== token) {
    try { client.realtime.disconnect(); } catch { /* ignore */ }
    client = null;
    connected = false;
    connecting = null;
  }
  if (!client) {
    clientToken = token;
    client = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
      ...(token ? { accessToken: token, isServerMode: false } : {}),
    });
  }
  return client;
}

function setConnected(on: boolean) {
  if (connected === on) return;
  connected = on;
  if (on) everConnected = true;
  for (const l of stateListeners) {
    try { l(on); } catch { /* ignore */ }
  }
}

function dedupe(messageId?: string): boolean {
  if (!messageId) return false;
  const now = Date.now();
  if (seen.has(messageId)) return true;
  seen.set(messageId, now);
  // Trim: keep the window small so this never grows on a long session.
  if (seen.size > 400) {
    for (const [k, ts] of seen) if (now - ts > 60_000) seen.delete(k);
  }
  return false;
}

function dispatch(payload: Record<string, unknown>) {
  const meta0 = (payload as { meta?: { messageId?: string } }).meta;
  if (!seen.has(meta0?.messageId ?? "")) {
    for (const h of anyListeners) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
  }
  const meta = (payload as { meta?: { messageId?: string; channel?: string } }).meta;
  if (dedupe(meta?.messageId)) return;
  const channel = meta?.channel;
  const targets = channel ? handlers.get(channel) : null;
  if (targets) {
    for (const h of targets) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
    return;
  }
  // No channel in metadata: broadcast to handlers matching the payload table.
  const table = (payload as ChangePayload).table;
  if (!table) return;
  const byTable = handlers.get(`db:${table}`);
  if (byTable) for (const h of byTable) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
}

async function ensureConnected(): Promise<boolean> {
  if (!isBrowser) return false;
  // Realtime is a signed-in feature. Anonymous browsing keeps the polling
  // fallback in `realtime.ts`, which behaves exactly as before.
  if (!sessionToken()) return false;
  if (connected) return true;
  if (!connecting) {
    const rt = getClient().realtime;
    rt.on("connect", () => setConnected(true));
    rt.on("disconnect", () => setConnected(false));
    rt.on("connect_error", () => setConnected(false));
    rt.on("error", () => { /* subscribe/publish errors are non-fatal */ });
    rt.on(EVENT, (msg: Record<string, unknown>) => dispatch(msg));
    connecting = rt
      .connect()
      .then(() => { setConnected(true); })
      .catch(() => { setConnected(false); })
      .finally(() => { connecting = null; });
  }
  await connecting;
  return connected;
}

/** True once the socket has been up at least once this session. */
export function realtimeAvailable() {
  return everConnected;
}
export function realtimeConnected() {
  return connected;
}
export function onRealtimeState(cb: (on: boolean) => void) {
  stateListeners.add(cb);
  cb(connected);
  return () => stateListeners.delete(cb);
}

/**
 * Subscribe to a realtime channel. Returns an unsubscribe function; the
 * channel is only left when the last subscriber goes away.
 */
export function subscribeChannel(channel: string, handler: Handler): () => void {
  if (!isBrowser) return () => {};
  let set = handlers.get(channel);
  if (!set) { set = new Set(); handlers.set(channel, set); }
  set.add(handler);
  refs.set(channel, (refs.get(channel) ?? 0) + 1);

  if (refs.get(channel) === 1) {
    void ensureConnected().then((ok) => {
      if (!ok) return;
      void getClient().realtime.subscribe(channel).catch(() => {});
    });
  }

  return () => {
    const s = handlers.get(channel);
    s?.delete(handler);
    const n = (refs.get(channel) ?? 1) - 1;
    if (n <= 0) {
      refs.delete(channel);
      handlers.delete(channel);
      try { getClient().realtime.unsubscribe(channel); } catch { /* ignore */ }
    } else {
      refs.set(channel, n);
    }
  };
}

/** Observe every incoming change (used to invalidate read caches). */
export function onAnyChange(handler: Handler): () => void {
  anyListeners.add(handler);
  return () => anyListeners.delete(handler);
}

/** Listen for changes on a table (`db:<table>` channel). */
export function onTableChange(table: string, handler: Handler): () => void {
  return subscribeChannel(`db:${table}`, handler);
}

/** Listen for changes on several tables at once. */
export function onTablesChange(tables: string[], handler: Handler): () => void {
  const offs = tables.map((t) => onTableChange(t, handler));
  return () => offs.forEach((off) => off());
}

/**
 * Publish a change so every other client updates instantly. Fire-and-forget:
 * a publish needs a prior subscribe on the same channel, so we join first.
 */
export async function publishChange(channel: string, payload: ChangePayload) {
  if (!isBrowser) return;
  const ok = await ensureConnected();
  if (!ok) return;
  const rt = getClient().realtime;
  try {
    if (!rt.getSubscribedChannels().includes(channel)) {
      const res = await rt.subscribe(channel);
      if (res && (res as { ok?: boolean }).ok === false) return;
    }
    await rt.publish(channel, EVENT, payload as Record<string, unknown>);
  } catch { /* realtime is best-effort */ }
}

/** Announce a table write plus any scoped channels that care about it. */
export function publishTableChange(
  table: string,
  op: ChangePayload["op"],
  row?: Record<string, unknown> | null,
) {
  if (!isBrowser) return;
  const r = (row ?? undefined) as Record<string, unknown> | undefined;
  const id = r && (r.id as string | undefined);
  const payload: ChangePayload = { table, op, id, row: r, at: Date.now() };
  void publishChange(`db:${table}`, payload);

  // Scoped fan-out so a single screen can watch one entity cheaply.
  const scoped = new Set<string>();
  const add = (prefix: string, v: unknown) => {
    if (typeof v === "string" && v) scoped.add(`${prefix}:${v}`);
  };
  if (r) {
    if (table === "orders") add("order", id);
    add("order", r.order_id);
    add("user", r.user_id);
    add("user", r.customer_id);
    if (table === "restaurants") add("restaurant", id);
    add("restaurant", r.restaurant_id);
    if (table === "drivers") add("driver", id);
    add("driver", r.driver_id);
    if (table === "support_tickets") add("ticket", id);
    add("ticket", r.ticket_id);
    if (table === "merchant_managers") add("manager", id);
    add("manager", r.manager_id);
  }
  for (const ch of scoped) void publishChange(ch, payload);

  // Admin dashboards watch a single firehose channel instead of every table.
  void publishChange("admin", payload);
}

/** Tear everything down (logout / app switch). */
export function disconnectRealtime() {
  handlers.clear();
  refs.clear();
  anyListeners.clear();
  seen.clear();
  setConnected(false);
  try { client?.realtime.disconnect(); } catch { /* ignore */ }
}

if (isBrowser) {
  // Reconnect promptly when the tab wakes; Socket.IO also retries on its own.
  const wake = () => { if (refs.size > 0) void ensureConnected(); };
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
}
