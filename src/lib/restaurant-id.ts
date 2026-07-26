/**
 * Permanent, human-readable restaurant IDs (SCOO-000001, SCOO-000002, …).
 *
 * The code lives in `restaurants.code` and is assigned once — never derived
 * from the row order, so it stays stable forever. `ensureRestaurantCode`
 * lazily backfills any row created before this feature existed.
 */
import { listTable, patchRecord } from "./insforge-crud";

export const RESTAURANT_CODE_PREFIX = "SCOO-";

export function formatRestaurantCode(n: number) {
  return `${RESTAURANT_CODE_PREFIX}${String(Math.max(1, Math.floor(n))).padStart(6, "0")}`;
}

type CodeRow = { id: string; code?: string | null };

async function nextRestaurantCode(): Promise<string> {
  const rows = await listTable<CodeRow>("restaurants", { select: "id,code", limit: 1000 });
  const used = rows
    .map((r) => r.code ?? "")
    .filter((c) => c.startsWith(RESTAURANT_CODE_PREFIX))
    .map((c) => Number(c.slice(RESTAURANT_CODE_PREFIX.length)))
    .filter((n) => Number.isFinite(n));
  const max = used.length ? Math.max(...used) : 0;
  return formatRestaurantCode(max + 1);
}

const inflight = new Map<string, Promise<string>>();

/** Returns the restaurant's permanent code, assigning one if it has none. */
export function ensureRestaurantCode(row: { id: string; code?: string | null }): Promise<string> {
  if (row.code) return Promise.resolve(row.code);
  if (!row.id) return Promise.resolve("");
  const hit = inflight.get(row.id);
  if (hit) return hit;
  const p = (async () => {
    const code = await nextRestaurantCode();
    await patchRecord("restaurants", row.id, { code });
    return code;
  })();
  inflight.set(row.id, p);
  return p;
}
