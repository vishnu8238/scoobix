/**
 * Backend key/value store.
 *
 * A few small pieces of platform content (editorial spotlight, collection
 * inclusion requests) have no dedicated InsForge table. Instead of keeping
 * them in localStorage they are persisted as JSON rows in the existing
 * `app_settings` table, keyed by `key`. Best-effort: never throws.
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";

type KVRow = { id?: string; key?: string; value?: string };

const idCache = new Map<string, string>();

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const rows = await listTable<KVRow>("app_settings", { key: `eq.${key}`, limit: 1 });
    const row = rows[0];
    if (!row) return null;
    if (row.id) idCache.set(key, row.id);
    if (!row.value) return null;
    return JSON.parse(row.value) as T;
  } catch (err: any) {
    // P0.1 Compliance: Don't crash on unauthenticated hydration
    if (err?.isAuthError || err?.insforge_status === 401 || err?.insforge_status === 403) {
      console.warn(`[KV_STORE] Unauthorized read for "${key}". Using defaults.`);
      return null;
    }
    console.error(`[KV_STORE] Parse error for "${key}":`, err);
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value);
  try {
    let id = idCache.get(key);
    if (!id) {
      const rows = await listTable<KVRow>("app_settings", { key: `eq.${key}`, limit: 1 });
      id = rows[0]?.id;
      if (id) idCache.set(key, id);
    }
    if (id) {
      await patchRecord("app_settings", id, { value: payload });
    } else {
      const created = await createRecord<KVRow>("app_settings", { key, value: payload });
      if (created?.id) idCache.set(key, created.id);
    }
  } catch (err) {
    console.warn(`[KV_STORE] Silent failure for key "${key}" (likely unauthenticated):`, err);
  }
}
