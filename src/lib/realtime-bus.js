import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
const EVENT = "changed";
let socket = null;
let connecting = null;
let connected = false;
let everConnected = false;
const subscribed = new Set();
const refs = new Map(); // channel → subscriber count
const handlers = new Map(); // channel → handlers
const seen = new Map(); // messageId → ts (dedupe)
const stateListeners = new Set();
const anyListeners = new Set();
const isBrowser = typeof window !== "undefined";
/** Session token, read straight from storage to avoid an import cycle. */
const ACCESS_KEY = "scoobix_if_access_v1";
function sessionToken() {
    try {
        return localStorage.getItem(ACCESS_KEY);
    }
    catch {
        return null;
    }
}
/**
 * Handshake token: the signed-in user's JWT when present, otherwise the
 * publishable anon key (the realtime server accepts it as an anonymous
 * participant), so guests get live updates too.
 */
function handshakeToken() {
    return sessionToken() ?? INSFORGE_ANON_KEY;
}
let socketToken = null;
function setConnected(on) {
    if (connected === on)
        return;
    connected = on;
    if (on)
        everConnected = true;
    for (const l of stateListeners) {
        try {
            l(on);
        }
        catch { /* ignore */ }
    }
}
function dedupe(messageId) {
    if (!messageId)
        return false;
    const now = Date.now();
    if (seen.has(messageId))
        return true;
    seen.set(messageId, now);
    // Trim: keep the window small so this never grows on a long session.
    if (seen.size > 400) {
        for (const [k, ts] of seen)
            if (now - ts > 60000)
                seen.delete(k);
    }
    return false;
}
function dispatch(payload) {
    const meta = payload.meta;
    if (!seen.has(meta?.messageId ?? "")) {
        for (const h of anyListeners) {
            try {
                h(payload);
            }
            catch { /* ignore */ }
        }
    }
    if (dedupe(meta?.messageId))
        return;
    // The server echoes the channel as `realtime:<channel>`.
    const channel = meta?.channel?.replace(/^realtime:/, "");
    if (channel) {
        const targets = handlers.get(channel);
        if (targets)
            for (const h of targets) {
                try {
                    h(payload);
                }
                catch { /* ignore */ }
            }
        // A scoped/firehose channel must not also fire table handlers, or one
        // write would be delivered several times to the same screen.
        return;
    }
    // No channel in metadata: broadcast to handlers matching the payload table.
    const table = payload.table;
    if (!table)
        return;
    const byTable = handlers.get(`db:${table}`);
    if (byTable)
        for (const h of byTable) {
            try {
                h(payload);
            }
            catch { /* ignore */ }
        }
}
/** Re-join every active channel after a reconnect or session change. */
function resubscribeAll() {
    subscribed.clear();
    for (const channel of refs.keys())
        joinChannel(channel);
}
function joinChannel(channel) {
    if (!socket?.connected || subscribed.has(channel))
        return;
    subscribed.add(channel);
    socket.emit("realtime:subscribe", { channel }, (res) => {
        if (res && res.ok === false)
            subscribed.delete(channel);
    });
}
function leaveChannel(channel) {
    subscribed.delete(channel);
    if (socket?.connected)
        socket.emit("realtime:unsubscribe", { channel });
}
/**
 * Socket.IO is loaded on demand so its ~45 kB never lands in the initial
 * page bundle — the first screen paints, then realtime attaches.
 */
let ioPromise;
function loadIo() {
    if (!ioPromise)
        ioPromise = import("socket.io-client").then((m) => m.io);
    return ioPromise;
}
async function ensureConnected() {
    if (!isBrowser)
        return false;
    const token = handshakeToken();
    // Session changed (sign-in / sign-out): rebuild the socket so it
    // re-authenticates as the new identity.
    if (socket && socketToken !== token) {
        try {
            socket.removeAllListeners();
            socket.disconnect();
        }
        catch { /* ignore */ }
        socket = null;
        subscribed.clear();
        connecting = null;
        setConnected(false);
    }
    if (connected)
        return true;
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
            s.onAny((event, msg) => {
                if (event !== EVENT)
                    return; // realtime:error and presence events are non-fatal
                dispatch(msg);
            });
            await new Promise((resolve) => {
                const done = () => { cleanup(); resolve(); };
                const timer = window.setTimeout(done, 10000);
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
export function onRealtimeState(cb) {
    stateListeners.add(cb);
    cb(connected);
    return () => stateListeners.delete(cb);
}
/**
 * Subscribe to a realtime channel. Returns an unsubscribe function; the
 * channel is only left when the last subscriber goes away.
 */
export function subscribeChannel(channel, handler) {
    if (!isBrowser)
        return () => { };
    let set = handlers.get(channel);
    if (!set) {
        set = new Set();
        handlers.set(channel, set);
    }
    set.add(handler);
    refs.set(channel, (refs.get(channel) ?? 0) + 1);
    if (refs.get(channel) === 1) {
        void ensureConnected().then((ok) => { if (ok)
            joinChannel(channel); });
    }
    return () => {
        const s = handlers.get(channel);
        s?.delete(handler);
        const n = (refs.get(channel) ?? 1) - 1;
        if (n <= 0) {
            refs.delete(channel);
            handlers.delete(channel);
            leaveChannel(channel);
        }
        else {
            refs.set(channel, n);
        }
    };
}
/** Observe every incoming change (used to invalidate read caches). */
export function onAnyChange(handler) {
    anyListeners.add(handler);
    return () => anyListeners.delete(handler);
}
/** Listen for changes on a table (`db:<table>` channel). */
export function onTableChange(table, handler) {
    return subscribeChannel(`db:${table}`, handler);
}
/** Listen for changes on several tables at once. */
export function onTablesChange(tables, handler) {
    const offs = tables.map((t) => onTableChange(t, handler));
    return () => offs.forEach((off) => off());
}
/**
 * Publish a change so every other client updates instantly. Fire-and-forget:
 * a publish needs a prior subscribe on the same channel, so we join first.
 */
export async function publishChange(channel, payload) {
    if (!isBrowser)
        return;
    const ok = await ensureConnected();
    if (!ok)
        return;
    try {
        // A publish requires membership of the channel, so join it first.
        joinChannel(channel);
        socket?.emit("realtime:publish", { channel, event: EVENT, payload });
    }
    catch { /* realtime is best-effort */ }
}
/** Announce a table write plus any scoped channels that care about it. */
export function publishTableChange(table, op, row) {
    if (!isBrowser)
        return;
    const r = (row ?? undefined);
    const id = r && r.id;
    const payload = { table, op, id, row: r, at: Date.now() };
    void publishChange(`db:${table}`, payload);
    // Scoped fan-out so a single screen can watch one entity cheaply.
    const scoped = new Set();
    const add = (prefix, v) => {
        if (typeof v === "string" && v)
            scoped.add(`${prefix}:${v}`);
    };
    if (r) {
        if (table === "orders")
            add("order", id);
        add("order", r.order_id);
        add("user", r.user_id);
        add("user", r.customer_id);
        if (table === "restaurants")
            add("restaurant", id);
        add("restaurant", r.restaurant_id);
        if (table === "drivers")
            add("driver", id);
        add("driver", r.driver_id);
        if (table === "support_tickets")
            add("ticket", id);
        add("ticket", r.ticket_id);
        if (table === "merchant_managers")
            add("manager", id);
        add("manager", r.manager_id);
        if (table === "logistics_zones")
            add("zone", id);
        add("zone", r.zone_id);
        if (table === "subzones")
            add("subzone", id);
        add("subzone", r.subzone_id);
    }
    for (const ch of scoped)
        void publishChange(ch, payload);
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
    try {
        socket?.removeAllListeners();
        socket?.disconnect();
    }
    catch { /* ignore */ }
    socket = null;
    socketToken = null;
}
if (isBrowser) {
    // Reconnect promptly when the tab wakes; Socket.IO also retries on its own.
    const wake = () => { if (refs.size > 0)
        void ensureConnected(); };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", () => { if (!document.hidden)
        wake(); });
}
