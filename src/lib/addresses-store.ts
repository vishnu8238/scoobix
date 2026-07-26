/**
 * Saved delivery addresses.
 *
 * The InsForge schema has no dedicated addresses table, so addresses persist
 * as a JSON row in `app_settings` keyed per user (`addresses:<userId>`).
 * Shared by the profile editor and checkout so both always agree.
 */
import { useCallback, useEffect, useState } from "react";
import { kvGet, kvSet } from "./kv-store";
import { useAuth } from "./auth-store";

export type AddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  default: boolean;
};

export function useAddresses() {
  const { user } = useAuth();
  const userId = user?.id ?? "guest";
  const key = `addresses:${userId}`;
  const [rows, setRows] = useState<AddressRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void kvGet<AddressRow[]>(key).then((v) => {
      if (cancelled) return;
      setRows(Array.isArray(v) ? v : []);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [key]);

  const commit = useCallback((next: AddressRow[]) => {
    setRows(next);
    void kvSet(key, next);
  }, [key]);

  const add = useCallback((draft: Omit<AddressRow, "id" | "default">) => {
    setRows((prev) => {
      const next = [...prev, { ...draft, id: `a${Date.now().toString(36)}`, default: prev.length === 0 }];
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  const update = useCallback((id: string, patch: Partial<AddressRow>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  const remove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (next.length > 0 && !next.some((r) => r.default)) next[0] = { ...next[0], default: true };
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  const setDefault = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, default: r.id === id }));
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  return { rows, loaded, add, update, remove, setDefault, commit };
}
