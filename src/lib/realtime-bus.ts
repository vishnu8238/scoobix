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
import type { Socket } from "socket.io-client";
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

let socket: Socket | null = null;
let connecting: Promise<void> | null = null;
let connected = false;
let everConnected = false;
const subscribed = new Set<string>();

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

/**
 * Handshake token: the signed-in user's JWT when present, otherwise the
 * publishable anon key (the realtime server accepts it as an anonymous
 * participant), so guests get live updates too.
 */
function handshakeToken(): string {
  return sessionToken() ?? INSFORGE_ANON_KEY;
}

let socketToken: string | null = null;

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
  const meta = (payload as { meta?: { messageId?: string; channel?: string } }).meta;
  if (!seen.has(meta?.messageId ?? "")) {
    for (const h of anyListeners) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
  }
  if (dedupe(meta?.messageId)) return;
  // The server echoes the channel as `realtime:<channel>`.
  const channel = meta?.channel?.replace(/^realtime:/, "");
  if (channel) {
    const targets = handlers.get(channel);
    if (targets) for (const h of targets) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
    // A scoped/firehose channel must not also fire table handlers, or one
    // write would be delivered several times to the same screen.
    return;
  }
  // No channel in metadata: broadcast to handlers matching the payload table.
  const table = (payload as ChangePayload).table;
  if (!table) return;
  const byTable = handlers.get(`db:${table}`);
  if (byTable) for (const h of byTable) { try { h(payload as ChangePayload); } catch { /* ignore */ } }
}

/** Re-join every active channel after a reconnect or session change. */
function resubscribeAll() {
  subscribed.clear();
  for (const channel of refs.keys()) joinChannel(channel);
}

function joinChannel(channel: string) {
  if (!socket?.connected || subscribed.has(channel)) return;
  subscribed.add(channel);
  socket.emit("realtime:subscribe", { channel }, (res: { ok?: boolean } | undefined) => {
    if (res && res.ok === false) subscribed.delete(channel);
  });
}

function leaveChannel(channel: string) {
  subscribed.delete(channel);
  if (socket?.connected) socket.emit("realtime:unsubscribe", { channel });
}

/**
 * Socket.IO is loaded on demand so its ~45 kB never lands in the initial
 * page bundle — the first screen paints, then realtime attaches.
 */
let ioPromise: Promise<typeof import("socket.io-client")["io"]> | undefined;
function loadIo() {
  if (!ioPromise) ioPromise = import("socket.io-client").then((m) => m.io);
  return ioPromise;
}

async function ensureConnected(): Promise<boolean> {
  if (!isBrowser) return false;
  const token = handshakeToken();
  // Session changed (sign-in / sign-out): rebuild the socket so it
  // re-authenticates as the new identity.
  if (socket && socketToken !== token) {
    try { socket.removeAllListeners(); socket.disconnect(); } catch { /* ignore */ }
    socket = null;
    subscribed.clear();
    connecting = null;
    setConnected(false);
  }
  if (connected) return true;
  if (!connecting) {
    socketToken = token;
    // Assigned synchronously so two concurrent callers can never open two sockets.
    connecting = (async () => {
      const io = await loadIo();
      const s = io(INSFORGE_URL, {
        transports: ["websocket"],
        auth: { token },
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
      });
      socket = s;
      s.on("connect", () => { setConnected(true); resubscribeAll(); });
      s.on("disconnect", () => { subscribed.clear(); setConnected(false); });
      s.on("connect_error", () => setConnected(false));
      s.onAny((event: string, msg: Record<string, unknown>) => {
        if (event !== EVENT) return;   // realtime:error and presence events are non-fatal
        dispatch(msg);
      });
      await new Promise<void>((resolve) => {
        const done = () => { cleanup(); resolve(); };
        const timer = window.setTimeout(done, 10_000);
        const cleanup = () => {
          window.clearTimeout(timer);
          s.off("connect", done);
          s.off("connect_error", done);
        };
        s.once("connect", done);
        s.once("connect_error", done);
      });
    })().finally(() => { connecting = null; });
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
    void ensureConnected().then((ok) => { if (ok) joinChannel(channel); });
  }

  return () => {
    const s = handlers.get(channel);
    s?.delete(handler);
    const n = (refs.get(channel) ?? 1) - 1;
    if (n <= 0) {
      refs.delete(channel);
      handlers.delete(channel);
      leaveChannel(channel);
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
  try {
    // A publish requires membership of the channel, so join it first.
    joinChannel(channel);
    socket?.emit("realtime:publish", { channel, event: EVENT, payload });
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
    if (table === "drivers" || table === "rider_gig_enrollments") add("driver", id);
    add("driver", r.driver_id);
    if (table === "support_tickets") add("ticket", id);
    add("ticket", r.ticket_id);
    if (table === "merchant_managers") add("manager", id);
    add("manager", r.manager_id);
    if (table === "logistics_zones") add("zone", id);
    add("zone", r.zone_id);
    if (table === "subzones") add("subzone", id);
    add("subzone", r.subzone_id);
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
  subscribed.clear();
  try { socket?.removeAllListeners(); socket?.disconnect(); } catch { /* ignore */ }
  socket = null;
  socketToken = null;
}

if (isBrowser) {
  // Reconnect promptly when the tab wakes; Socket.IO also retries on its own.
  const wake = () => { if (refs.size > 0) void ensureConnected(); };
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
}
