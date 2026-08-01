/**
 * Immutable audit trail.
 *
 * Design
 *  - `logAudit()` never blocks the caller: entries are queued and flushed as a
 *    single batched insert (same trick as the notification queue), so auditing
 *    an action costs ~0 ms on the critical path.
 *  - Nothing in the app updates or deletes an audit row. The only mutation is
 *    the retention job flipping `archived = true` on rows past the window.
 *  - Every entry carries actor, action, category, subject, severity and request
 *    context (ip/device/session) so a trail can be reconstructed per subject.
 */
import { createRecords, listTable, listPage, patchWhereIn, invalidateTable } from "./insforge-crud";
import { deviceContext } from "./device-context";

export const AUDIT_TABLE = "audit_logs";

export type AuditCategory =
  | "auth" | "user" | "restaurant" | "rider" | "manager" | "admin" | "support"
  | "wallet" | "coupon" | "reward" | "subscription" | "payment" | "kyc"
  | "settings" | "security" | "privacy";

export type AuditSeverity = "info" | "notice" | "warning" | "critical";

export type AuditEntry = {
  action: string;
  category: AuditCategory;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  subjectType?: string;
  subjectId?: string;
  summary?: string;
  severity?: AuditSeverity;
  meta?: Record<string, unknown>;
};

export type AuditRow = {
  id: string;
  actor_id?: string; actor_role?: string; actor_name?: string;
  action?: string; category?: string; subject_type?: string; subject_id?: string;
  summary?: string; severity?: string; meta?: Record<string, unknown> | null;
  ip?: string; user_agent?: string; device_id?: string; session_id?: string;
  archived?: boolean; created_at?: string;
};

const FLUSH_MS = 1200;
const MAX_BATCH = 40;

let pending: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function row(entry: AuditEntry): Record<string, unknown> {
  const ctx = deviceContext();
  return {
    actor_id: entry.actorId ?? null,
    actor_role: entry.actorRole ?? "system",
    actor_name: entry.actorName ?? null,
    action: entry.action,
    category: entry.category,
    subject_type: entry.subjectType ?? null,
    subject_id: entry.subjectId ?? null,
    summary: entry.summary ?? entry.action,
    severity: entry.severity ?? "info",
    meta: entry.meta ?? null,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent,
    device_id: ctx.deviceId,
    session_id: ctx.sessionId,
    archived: false,
    created_at: new Date().toISOString(),
  };
}

/** Queue one audit entry. Fire-and-forget by design — never awaited by UI code. */
export function logAudit(entry: AuditEntry): void {
  if (!entry?.action) return;
  pending.push(row(entry));
  if (pending.length >= MAX_BATCH) void flushAudit();
  else if (!timer) timer = setTimeout(() => void flushAudit(), FLUSH_MS);
}

/** Queue several entries at once. */
export function logAuditBatch(entries: AuditEntry[]): void {
  entries.forEach(logAudit);
}

/** Write everything pending in one insert. Never throws. */
export async function flushAudit(): Promise<number> {
  if (timer) { clearTimeout(timer); timer = undefined; }
  if (!pending.length) return 0;
  const batch = pending;
  pending = [];
  try {
    await createRecords(AUDIT_TABLE, batch);
    invalidateTable(AUDIT_TABLE);
    return batch.length;
  } catch {
    return 0;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushAudit();
  });
  window.addEventListener("pagehide", () => void flushAudit());
}

/* ------------------------------------------------------------------ reads */

export type AuditFilter = {
  actorId?: string;
  actorRole?: string;
  category?: AuditCategory | "all";
  subjectType?: string;
  subjectId?: string;
  action?: string;
  severity?: AuditSeverity | "all";
  since?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
};

const SELECT =
  "id,actor_id,actor_role,actor_name,action,category,subject_type,subject_id,summary," +
  "severity,meta,ip,user_agent,device_id,session_id,archived,created_at";

export async function listAudit(filter: AuditFilter = {}): Promise<AuditRow[]> {
  const params: Record<string, string | number> = { select: SELECT, order: "created_at.desc" };
  if (filter.actorId) params.actor_id = `eq.${filter.actorId}`;
  if (filter.actorRole) params.actor_role = `eq.${filter.actorRole}`;
  if (filter.category && filter.category !== "all") params.category = `eq.${filter.category}`;
  if (filter.subjectType) params.subject_type = `eq.${filter.subjectType}`;
  if (filter.subjectId) params.subject_id = `eq.${filter.subjectId}`;
  if (filter.action) params.action = `eq.${filter.action}`;
  if (filter.severity && filter.severity !== "all") params.severity = `eq.${filter.severity}`;
  if (filter.since) params.created_at = `gte.${filter.since}`;
  if (!filter.includeArchived) params.archived = "eq.false";
  return listPage<AuditRow>(AUDIT_TABLE, filter.page ?? 0, filter.pageSize ?? 50, params, { ttl: 30 });
}

/** Complete trail for one subject (user, restaurant, rider, order…). */
export function subjectTrail(subjectType: string, subjectId: string, limit = 100) {
  return listTable<AuditRow>(
    AUDIT_TABLE,
    { select: SELECT, subject_type: `eq.${subjectType}`, subject_id: `eq.${subjectId}`, order: "created_at.desc", limit },
    { ttl: 30 },
  );
}

/** Everything one actor did (admin action log, restaurant log, rider log…). */
export function actorTrail(actorId: string, limit = 100) {
  return listTable<AuditRow>(
    AUDIT_TABLE,
    { select: SELECT, actor_id: `eq.${actorId}`, order: "created_at.desc", limit },
    { ttl: 30 },
  );
}

export type AuditStats = {
  total: number;
  byCategory: { id: string; label: string; value: number }[];
  byRole: { id: string; label: string; value: number }[];
  critical: number;
  last24h: number;
};

export async function auditStats(days = 30): Promise<AuditStats> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await listPage<AuditRow>(
    AUDIT_TABLE,
    0, 200,
    { select: "category,actor_role,severity,created_at", created_at: `gte.${since}`, order: "created_at.desc" },
    { ttl: 60 },
  );
  const count = (key: keyof AuditRow) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = String(r[key] ?? "unknown");
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([id, value]) => ({ id, label: id, value })).sort((a, b) => b.value - a.value);
  };
  const dayAgo = Date.now() - 86400_000;
  return {
    total: rows.length,
    byCategory: count("category"),
    byRole: count("actor_role"),
    critical: rows.filter((r) => r.severity === "critical").length,
    last24h: rows.filter((r) => Date.parse(String(r.created_at ?? "")) > dayAgo).length,
  };
}

/* -------------------------------------------------------------- retention */

/**
 * Archive audit rows older than `days`. Rows are flagged, never deleted, so the
 * trail stays immutable while dashboards only scan the live window.
 * Requires the `audit.archive` permission at the call site.
 */
export async function archiveOldAudit(days = 180, batch = 200): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const old = await listPage<{ id: string }>(
    AUDIT_TABLE, 0, batch,
    { select: "id,created_at,archived", created_at: `lt.${cutoff}`, archived: "eq.false", order: "created_at.asc" },
    { ttl: 0 },
  );
  if (!old.length) return 0;
  await patchWhereIn(AUDIT_TABLE, old.map((r) => r.id), { archived: true });
  invalidateTable(AUDIT_TABLE);
  return old.length;
}
