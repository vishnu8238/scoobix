/**
 * React hooks over the realtime layer.
 *
 * Two shapes:
 *  - `useLiveTable` / `useLiveOrders` … : row streams from the `realtime.ts`
 *    engine, now push-driven (WebSocket) with polling as a safety net.
 *  - `useTableVersion` / `useLiveData`: a lightweight "something changed"
 *    signal for screens that load through `insforge-crud` and just need to
 *    re-run their own fetch instead of holding a row stream.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeTable, type SubscribeOptions } from "./realtime";
import { onTablesChange, subscribeChannel, type ChangePayload } from "./realtime-bus";

type Row = Record<string, unknown>;

export function useLiveTable<T = Row>(
  table: string,
  opts: SubscribeOptions = {},
): { rows: T[]; loading: boolean } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  // Stable JSON key so React only re-subscribes when filters truly change.
  const paramsKey = JSON.stringify(opts.params ?? null);
  const matchKey = JSON.stringify(opts.match ?? null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeTable(table, optsRef.current, (rs) => {
      setRows(rs as T[]);
      setLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, paramsKey, matchKey]);

  return { rows, loading };
}

/**
 * Bumps a counter whenever any of `tables` changes anywhere on the platform.
 * Use it as a dependency to re-run an existing loader — no polling needed.
 */
export function useTableVersion(tables: string[]): number {
  const key = tables.join(",");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!key) return;
    return onTablesChange(key.split(","), () => setVersion((v) => v + 1));
  }, [key]);
  return version;
}

/** Subscribe to one scoped channel (`order:<id>`, `ticket:<id>`, `admin`, …). */
export function useChannelVersion(channel: string | null | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!channel) return;
    return subscribeChannel(channel, () => setVersion((v) => v + 1));
  }, [channel]);
  return version;
}

/** Listen to a scoped channel with a callback (cleaned up automatically). */
export function useChannelEvent(
  channel: string | null | undefined,
  handler: (p: ChangePayload) => void,
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!channel) return;
    return subscribeChannel(channel, (p) => ref.current(p));
  }, [channel]);
}

/**
 * Realtime-driven data loader: runs `load()` on mount and again whenever any
 * of `tables` changes. Replaces every `setInterval(load, N)` refresh loop.
 */
export function useLiveData<T>(
  tables: string[],
  load: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | undefined; loading: boolean; reload: () => void } {
  const version = useTableVersion(tables);
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const depKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadRef
      .current()
      .then((v) => { if (!cancelled) { setData(v); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, manual, depKey]);

  const reload = useCallback(() => setManual((n) => n + 1), []);
  return { data, loading, reload };
}

export function useLiveOrders(match?: Record<string, string | number | boolean | null>) {
  return useLiveTable<Row>("orders", {
    params: { limit: 500, order: "-created_at" },
    match,
    minMs: 2000,
    maxMs: 15000,
  });
}

export function useLiveOrder(orderId: string | undefined) {
  const { rows } = useLiveTable<Row>("orders", {
    params: { limit: 500 },
    match: orderId ? { id: orderId } : { id: "__none__" },
    minMs: 1500,
    maxMs: 8000,
  });
  return rows[0];
}

export function useLiveDriverLocations(driverIds?: string[]) {
  const { rows } = useLiveTable<Row>("driver_tracking", {
    params: { limit: 1000 },
    minMs: 3000,
    maxMs: 20000,
  });
  // Keep only latest ping per driver.
  const seen = new Set<string>();
  const latest: Row[] = [];
  // Newest ping is last in insertion order — walk backwards.
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const id = String(r.driver_id ?? "");
    if (!id || seen.has(id)) continue;
    if (driverIds && !driverIds.includes(id)) continue;
    seen.add(id);
    latest.push(r);
  }
  return latest;
}

export function useLiveDrivers() {
  return useLiveTable<Row>("drivers", {
    params: { limit: 500 },
    minMs: 4000,
    maxMs: 20000,
  });
}

/** Live support-ticket conversation (customer, partner, rider, manager, admin). */
export function useLiveTicketMessages(ticketId: string | undefined) {
  const { rows, loading } = useLiveTable<Row>("support_ticket_messages", {
    params: { limit: 200, order: "created_at" },
    match: ticketId ? { ticket_id: ticketId } : { ticket_id: "__none__" },
    minMs: 3000,
    maxMs: 20000,
  });
  return { messages: rows, loading };
}

/** Live wallet / loyalty / notification counters for one user. */
export function useLiveUserRows(table: string, userId: string | undefined, field = "user_id") {
  const match = useMemo(
    () => ({ [field]: userId ?? "__none__" }),
    [field, userId],
  );
  return useLiveTable<Row>(table, { params: { limit: 200, order: "-created_at" }, match, minMs: 4000, maxMs: 30000 });
}
