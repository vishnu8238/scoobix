/**
 * React hooks over the `realtime.ts` adaptive-polling engine.
 */
import { useEffect, useRef, useState } from "react";
import { subscribeTable, type SubscribeOptions } from "./realtime";

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
    params: { limit: 1000, order: "-timestamp" },
    minMs: 3000,
    maxMs: 20000,
  });
  // Keep only latest ping per driver.
  const seen = new Set<string>();
  const latest: Row[] = [];
  for (const r of rows) {
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
