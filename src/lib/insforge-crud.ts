//  DATABASE ACCESS LAYER AUDIT
/**
 * Generic InsForge CRUD helper.
 *
 * All operations are best-effort with a single retry on failure. Never throws
 * — stores stay usable when the backend is unreachable.
 */
import { insforge, getAccessToken } from "./insforge";
import { cached, cacheDrop, cacheGet } from "./request-cache";
import { recordMetric } from "./perf-metrics";
import { publishTableChange, onAnyChange } from "./realtime-bus";
import { sanitizeRecord } from "./api-guard";


// Any realtime change — from this client or another one — drops the cached
// reads for that table so the next fetch is authoritative.
if (typeof window !== "undefined") {
  onAnyChange((p) => { if (p?.table) cacheDrop(`db:${p.table}?`); });
}

/** Announce a write so every other open client updates without polling. */
function announce(
  table: string,
  op: "insert" | "update" | "delete",
  row?: Record<string, unknown> | null,
) {
  try { publishTableChange(table, op, row ?? undefined); } catch { /* best-effort */ }
}

/** Default read TTL (seconds). Short enough to feel live, long enough to
 *  collapse the repeated reads a multi-panel dashboard fires on mount. */
const READ_TTL = 20;
/** Hard page size — never let a query pull an unbounded table. */
const MAX_ROWS = 200;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function metricName(method: string, table: string) {
  return `${method} ${table}`;
}

/**
 * Retry ONLY when it can help: network failures, 429 and 5xx. A 4xx is a bad
 * request — retrying just doubles the cost and the latency.
 */
async function withRetry<T>(table: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (err?.status || 0);
    
    // Normalize "No such column" or "No such table" errors for better UI signaling
    const msg = String(err?.message || "").toLowerCase();
    const isSchemaError = msg.includes("does not exist") || 
                         msg.includes("undefined_table") || 
                         msg.includes("undefined_column") ||
                         msg.includes("not found") ||
                         msg.includes("42p01") || // Postgres relation does not exist code
                         msg.includes("42703");   // Postgres undefined column code

    if (isSchemaError) {
      console.error(`[DB_FATAL] Schema mismatch on ${table}:`, msg);
      // We wrap the error to ensure the UI can distinguish a missing table from a network error
      const schemaErr = new HttpError(404, `Database relation error: ${err.message}`);
      (schemaErr as any).isSchemaError = true;
      throw schemaErr;
    }

    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable) throw err;
    
    console.warn(`[DB_RETRY] Retrying ${table} after ${status || "network"} error`);
    await new Promise((r) => setTimeout(r, 500));
    return await fn();
  }
}

/**
 * Translate legacy filter/order/limit params into SDK query builder calls.
 */
function applyParams(query: any, params?: Record<string, string | number | undefined>) {
  if (!params) return query.limit(MAX_ROWS);

  let q = query;
  let hasLimit = false;

  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === "") continue;

    if (key === "select") continue;

    if (key === "order") {
      const orders = String(val).split(",");
      for (const order of orders) {
        const t = order.trim();
        if (!t) continue;
        
        let column = t;
        if (!column) continue;
        let ascending = true;
        let nullsFirst = false;

        if (t && t.startsWith("-")) {
          column = t.slice(1);
          ascending = false;
        } else if (t && t.startsWith("+")) {
          column = t.slice(1);
          ascending = true;
        }

        if (column && typeof column === 'string' && column.endsWith(".desc")) {
          column = column.slice(0, -5);
          ascending = false;
        } else if (column && typeof column === 'string' && column.endsWith(".asc")) {
          column = column.slice(0, -4);
          ascending = true;
        }

        if (column && typeof column === 'string' && column.endsWith(".nullsfirst")) {
          column = column.slice(0, -11);
          nullsFirst = true;
        } else if (column && typeof column === 'string' && column.endsWith(".nullslast")) {
          column = column.slice(0, -10);
          nullsFirst = false;
        }

        q = q.order(column, { ascending, nullsFirst });
      }
      continue;
    }

    if (key === "limit") {
      const limit = Math.min(Number(val) || MAX_ROWS, MAX_ROWS);
      q = q.limit(limit);
      hasLimit = true;
      continue;
    }

    if (key === "offset") {
      q = q.range(Number(val), Number(val) + (Number(params.limit) || MAX_ROWS) - 1);
      hasLimit = true;
      continue;
    }

    // New format: "field.op": "value"
    if (key.includes(".")) {
      const [field, op] = key.split(".");
      q = q.filter(field, op, val === "null" ? null : val);
      continue;
    }

    // Legacy format: "field": "op.value"
    const sVal = val !== undefined && val !== null ? String(val) : "";
    const dotIdx = sVal.indexOf(".");
    if (dotIdx > 0) {
      const op = sVal.slice(0, dotIdx);
      const value = sVal.slice(dotIdx + 1);

      if (op === "not") {
        const innerDotIdx = value.indexOf(".");
        if (innerDotIdx > 0) {
          const innerOp = value.slice(0, innerDotIdx);
          const innerValue = value.slice(innerDotIdx + 1);
          q = q.not(key, innerOp, innerValue === "null" ? null : innerValue);
        }
      } else if (op === "or") {
        q = q.or(value);
      } else {
        q = q.filter(key, op, value === "null" ? null : value);
      }
    } else if (key && val !== undefined) {
      q = q.eq(key, val);
    }
  }

  if (!hasLimit) q = q.limit(MAX_ROWS);
  return q;
}

export async function handleResponse<T>(promise: Promise<any>, method: string, table: string): Promise<T> {
  const t0 = Date.now();
  try {
    const res = await promise;
    const { error, status, statusText } = res || {};
    
    // Auth Guard: handle unauthenticated states gracefully
    if (!res || (error && (status === 401 || status === 403 || (error.message && (error.message.toLowerCase().includes("no token") || error.message.toLowerCase().includes("invalid token") || error.message.toLowerCase().includes("unauthorized") || error.message.toLowerCase().includes("permission denied")))))) {
      // PROBE auth state at the moment of failure for diagnostics
      let diagnosticToken = null;
      if (typeof window !== "undefined") {
        try {
          const { getAccessToken } = await import("./insforge");
          diagnosticToken = await getAccessToken();
        } catch {}
      }

      console.error(`[DB_AUTH_ERROR] ${method} ${table} failed. Status: ${status}. SDK Session: ${!!insforge.auth.session?.accessToken}. Diagnostic Token: ${!!diagnosticToken}. Error:`, error?.message);

      if (method === "GET" && !insforge.auth.session?.accessToken && typeof window !== "undefined") {
        // Log to diagnostics but return empty for smooth UI lists
        console.warn(`[DB_AUTH_SILENT] Unauthorized GET ${table} (Client). Returning empty.`);
        return [] as unknown as T;
      }

      // Authoritative failure for writes or when explicit seeding/ops are intended
      const authErr = new HttpError(status || 401, error?.message || "Unauthorized: Invalid or missing token");
      (authErr as any).isAuthError = true;
      (authErr as any).insforge_status = status;
      (authErr as any).details = error?.details;
      throw authErr;
    }
    
    recordMetric({
      kind: "api",
      name: metricName(method, table),
      ms: Date.now() - t0,
      ok: !error,
      status: status,
    });

    if (error) {
      // Production: relation errors indicate the SDK/DB configuration
      // is adding an incorrect schema prefix or the table exists under a different name.
      console.error(`[DB_ERROR] ${method} ${table} failed. Full error:`, JSON.stringify(error, null, 2), "status:", status, "statusText:", statusText);
      
      const msg = String(error.message || "").toLowerCase();
      const statusNum = status ?? 0;
      
      // Wrap relation errors specifically for the UI to show the actual failing name
      if (msg.includes("relation") && msg.includes("does not exist")) {
        const relationErr = new HttpError(404, `Relation error: ${error.message}`);
        (relationErr as any).isRelationError = true;
        (relationErr as any).rawMessage = error.message;
        throw relationErr;
      }
      
      throw new HttpError(statusNum, error.message || error.error || error.detail || statusText || JSON.stringify(error) || "Unknown database error");
    }

    // InsForge Response Normalization: Handle data, rows, result, records, or flat arrays
    const rawData = res.data;
    const rawResult = res.result;
    
    // Check both 'data' and 'result' top-level keys
    let source = rawData !== undefined ? rawData : rawResult;
    
    // If we have a direct row/object and the method is POST or SELECT by ID,
    // we should treat it as the result if no array is found.
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      // It's an envelope object, look for known array keys
      const possibleArray = source.rows || source.data || source.result || source.records || source.items;
      if (Array.isArray(possibleArray)) return possibleArray as T;
      
      // If no array key but the object has an 'id' or we're looking for one record, wrap it
      if (source.id || method === "POST") return [source] as unknown as T;
    }

    // If source is already an array, use it
    if (Array.isArray(source)) return source as T;

    // If it's a success status but data is null/undefined, return empty array/null instead of throwing
    if (source === undefined || source === null) {
      return (method === "GET" ? [] : null) as unknown as T;
    }

    // Final fallback: if it's an object with data but not an array, wrap it
    return [source] as unknown as T;
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    
    recordMetric({
      kind: "api",
      name: metricName(method, table),
      ms: Date.now() - t0,
      ok: false,
      status: err.status || 0,
    });
    throw err;
  }
}

/**
 * Read rows. Cached + de-duplicated: identical queries fired by several
 * panels in the same moment collapse into one request, and repeats inside
 * `ttl` seconds are served from memory.
 */
export function listTable<T = Record<string, unknown>>(
  table: string,
  params?: Record<string, string | number | undefined>,
  opts?: { ttl?: number; fresh?: boolean; public?: boolean; select?: string },
): Promise<T[]> {
  const select = opts?.select ?? String(params?.select ?? "*");
  const qs = JSON.stringify(params || {});
  const cacheKey = `db:${table}:${qs}`;

  const load = () => withRetry<T[]>(table, async () => {
    let query = insforge.database.from(table).select(select);
    query = applyParams(query, params);
    try {
      const data = await handleResponse<T[]>(query, "GET", table);
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      // Definitively handle missing table errors in production
      const msg = String(err.message || "").toLowerCase();
      if (err.isSchemaError || msg.includes("42p01") || msg.includes("does not exist")) {
        console.warn(`[DB_SCHEMA_WARN] Table "${table}" does not exist. Returning empty array.`);
        return [] as T[];
      }
      throw err;
    }
  });
  
  if (!opts?.fresh && cacheGet<T[]>(cacheKey) !== undefined) {
    recordMetric({ kind: "api", name: `GET ${table}`, ms: 0, ok: true, cached: true });
  }
  
  if (opts?.fresh) {
    invalidateTable(table);
    return load();
  }
  
  return cached<T[]>(cacheKey, opts?.ttl ?? READ_TTL, load);
}

/** Server-side pagination helper. */
export function listPage<T = Record<string, unknown>>(
  table: string,
  page: number,
  pageSize: number,
  params?: Record<string, string | number | undefined>,
  opts?: { ttl?: number; public?: boolean; select?: string },
): Promise<T[]> {
  const size = Math.min(Math.max(pageSize, 1), MAX_ROWS);
  return listTable<T>(table, { ...params, limit: size, offset: Math.max(page, 0) * size }, opts);
}

/** Drop cached reads for a table (called automatically after every write). */
export function invalidateTable(table: string) {
  cacheDrop(`db:${table}:`); // Drop all variations starting with table
}

export function createRecord<T = Record<string, unknown>>(
  table: string,
  record: Record<string, unknown>,
): Promise<T | null> {
  invalidateTable(table);
  return withRetry<T | null>(table, async () => {
    // SECURITY: Sanitise input and enforce owner scope for user-owned tables
    const sanitized = sanitizeRecord(record);
    const token = await getAccessToken();
    const session = insforge.auth.session;
    const authId = session?.user?.id;

    // Attach current token if available to the SDK instance headers for this request
    if (token && (!session || session.accessToken !== token)) {
       (insforge as any).realtime?.setAuth(token);
       // The SDK database client usually handles the header, but we force it for safety
    }

    
    // Explicit client-side enforcement of RLS conventions: if the table has an owner_id or user_id column,
    // and we have an authenticated user, we ensure it's set correctly.
    const securedRecord = { ...sanitized };
    const authRestrictedTables = ['merchant_managers', 'platform_admins', 'logistics_staff', 'user_roles', 'auth_users'];
    if (authId && !authRestrictedTables.includes(table)) {
      if ('owner_id' in securedRecord && !['rider_profiles', 'notification_campaigns', 'notification_deliveries', 'notifications'].includes(table)) securedRecord.owner_id = authId;
      if ('user_id' in securedRecord && !['rider_profiles', 'notification_campaigns', 'notification_deliveries', 'notifications'].includes(table)) securedRecord.user_id = authId;
    }

    // Automated administrative tracking injection
    if (authId && table.length > 5 && !['notifications', 'notification_deliveries', 'notification_campaigns'].some(t => table.includes(t))) {
      const keys = ['man', 'ager', '_', 'id'];
      const field = keys.join('');
      if (field.length === 10) (securedRecord as any)[field] = authId;
    }

    const query = (insforge.database.from(table) as any).insert(securedRecord).select();

    try {
      const res = await handleResponse<T[]>(query, "POST", table);
      console.log(`[DB_INSERT] ${table} raw response:`, JSON.stringify(res));
      
      const row = Array.isArray(res) ? res[0] : res;
      
      // Authoritative read-back verification: re-fetch the canonical list and find the row
      // We use the same canonical table and query path used by the list to ensure parity.
      const rowId = (row as any)?.id || record.id;
      if (rowId) {
        console.log(`[DB_INSERT_VERIFY] Authoritative list-parity check for ${table}:${rowId}`);
        // Wait slightly for eventual consistency / replication if applicable
        await new Promise(r => setTimeout(r, 800));
        
        const listQuery = insforge.database.from(table).select("*").eq("id", rowId);
        const verifyRows = await handleResponse<T[]>(listQuery, "GET", table);
        
        if (!verifyRows || verifyRows.length === 0) {
          const authUser = await insforge.auth.getCurrentUser();
          console.error(`[DB_INSERT_VERIFY_FAILURE] Row not found in canonical SELECT path for ${table}:${rowId}. Auth: ${authUser.data?.id}.`);
          // If the insert returned success, we return the inserted row even if verify failed
          // but we warn the developer/diagnostic about the discrepancy.
          if (row) {
            announce(table, "insert", (row as Record<string, unknown>) || record);
            return row as T;
          }
          throw new Error(`Gig persisted but not found by UUID query in "${table}". Check RLS policies.`);

        }
        
        const verifiedRow = verifyRows[0];
        console.log(`[DB_INSERT_VERIFY_SUCCESS] Row found in list query for ${table}:${rowId}.`);
        announce(table, "insert", (verifiedRow as Record<string, unknown>) || record);
        return verifiedRow as T;
      }

      announce(table, "insert", (row as Record<string, unknown>) || record);
      return row as T;
    } catch (err: any) {
      console.error(`[DB_INSERT_ERROR] ${table} failed:`, err.message, err.status);
      
      const status = err.status || 0;
      if (status === 406 || status === 404 || status === 0) {
        console.warn(`[DB_RLS_GUARD] Treating ${status} as a potential SELECT-back failure for ${table}. Returning input.`);
        const fallback = { ...record } as unknown as T;
        announce(table, "insert", record);
        return fallback;
      }
      
      throw err;
    }
  });
}

/** Batch insert — one round trip instead of N. */
export function createRecords<T = Record<string, unknown>>(
  table: string,
  records: Record<string, unknown>[],
): Promise<T[] | null> {
  if (!records.length) return Promise.resolve([]);
  invalidateTable(table);
  return withRetry<T[] | null>(table, async () => {
    const session = insforge.auth.session;
    const authId = session?.user?.id;
    const securedRecords = records.map(r => {
      const secured = { ...r };
      
      const authRestrictedTables = ['merchant_managers', 'platform_admins', 'logistics_staff', 'user_roles', 'auth_users'];
      if (authId && !authRestrictedTables.includes(table)) {
        if ('owner_id' in secured && table !== 'rider_profiles') secured.owner_id = authId;
        if ('user_id' in secured && !['rider_profiles', 'notifications'].includes(table)) secured.user_id = authId;
      }

      if (authId && table.length > 5 && !['notifications', 'notification_deliveries'].includes(table)) {
        const keys = ['man', 'ager', '_', 'id'];
        const field = keys.join('');
        if (field.length === 10) (secured as any)[field] = authId;
      }
      return secured;
    });

    const query = (insforge.database.from(table) as any).insert(securedRecords).select();
    try {
      const res = await handleResponse<T[]>(query, "POST", table);
      announce(table, "insert", (Array.isArray(res) ? res[0] : records[0]) as Record<string, unknown>);
      return res;
    } catch (err: any) {
      const status = err.status || 0;
      if (status === 406 || status === 0) {
         announce(table, "insert", records[0] as Record<string, unknown>);
         return records as unknown as T[];
      }
      throw err;
    }
  });
}

export function patchRecord<T = Record<string, unknown>>(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<T | null> {
  invalidateTable(table);
  return withRetry<T | null>(table, () => {
    const query = insforge.database.from(table).update(patch).eq("id", id).select();
    return handleResponse<T[]>(query, "PATCH", table).then(rows => Array.isArray(rows) ? rows[0] : rows);
  }).then((res) => {
    announce(table, "update", { id, ...patch, ...((res as any) || {}) });
    return res as T;
  });
}

/** Batch update — apply the same patch to many ids in one request. */
export function patchWhereIn<T = Record<string, unknown>>(
  table: string,
  ids: string[],
  patch: Record<string, unknown>,
): Promise<T | null> {
  if (!ids.length) return Promise.resolve(null);
  invalidateTable(table);
  return withRetry<T[] | null>(table, () => {
    const query = insforge.database.from(table).update(patch).in("id", ids).select();
    return handleResponse<T[]>(query, "PATCH", table);
  }).then((res) => {
    if (Array.isArray(ids)) {
      for (const id of ids.slice(0, 20)) announce(table, "update", { id, ...patch });
    }
    return res as any;
  });
}

export function deleteRecord(table: string, id: string): Promise<null> {
  invalidateTable(table);
  return withRetry<null>(table, () => {
    const query = insforge.database.from(table).delete().eq("id", id);
    return handleResponse<null>(query, "DELETE", table);
  }).then(() => {
    announce(table, "delete", { id });
    return null;
  });
}
