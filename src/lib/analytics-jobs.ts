/**
 * Background analytics jobs.
 *
 * Heavy aggregation (orders → revenue, AOV, top restaurants) never runs during
 * a user request. Instead:
 *   - a daily and a monthly summary are PRE-COMPUTED and stored as JSON in
 *     `app_settings` via the KV store,
 *   - dashboards read the pre-computed summary (one tiny row) instead of
 *     scanning the orders table,
 *   - recomputation happens in the background, when the browser is idle, and
 *     at most once per TTL.
 *
 * Cost model: one read per dashboard mount, one aggregate write per period.
 */
import { kvGet, kvSet } from "./kv-store";
import { listTable } from "./insforge-crud";

export type PeriodSummary = {
  period: string;
  orders: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  aov: number;
  newCustomers: number;
  topRestaurants: { id: string; orders: number; revenue: number }[];
  computedAt: number;
};

type OrderRow = {
  id?: string;
  status?: string;
  total?: number;
  grand_total?: number;
  restaurant_id?: string;
  user_id?: string;
  created_at?: string;
};

/** Recompute at most this often (ms). */
const DAILY_TTL = 30 * 60 * 1000;
const MONTHLY_TTL = 6 * 60 * 60 * 1000;

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

const kvKey = (scope: "daily" | "monthly", period: string) => `analytics:${scope}:${period}`;

function aggregate(period: string, rows: OrderRow[]): PeriodSummary {
  const revenueOf = (r: OrderRow) => Number(r.grand_total ?? r.total ?? 0) || 0;
  const delivered = rows.filter((r) => (r.status ?? "").toUpperCase() === "DELIVERED");
  const cancelled = rows.filter((r) => (r.status ?? "").toUpperCase() === "CANCELLED");
  const revenue = delivered.reduce((s, r) => s + revenueOf(r), 0);

  const byRestaurant = new Map<string, { orders: number; revenue: number }>();
  for (const r of rows) {
    if (!r.restaurant_id) continue;
    const e = byRestaurant.get(r.restaurant_id) ?? { orders: 0, revenue: 0 };
    e.orders += 1;
    e.revenue += revenueOf(r);
    byRestaurant.set(r.restaurant_id, e);
  }

  return {
    period,
    orders: rows.length,
    delivered: delivered.length,
    cancelled: cancelled.length,
    revenue: Math.round(revenue),
    aov: delivered.length ? Math.round(revenue / delivered.length) : 0,
    newCustomers: new Set(rows.map((r) => r.user_id).filter(Boolean)).size,
    topRestaurants: [...byRestaurant.entries()]
      .map(([id, e]) => ({ id, orders: e.orders, revenue: Math.round(e.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    computedAt: Date.now(),
  };
}

async function computeAndStore(scope: "daily" | "monthly", period: string): Promise<PeriodSummary> {
  const from = scope === "daily" ? `${period}T00:00:00` : `${period}-01T00:00:00`;
  const rows = await listTable<OrderRow>(
    "orders",
    {
      select: "id,status,total,grand_total,restaurant_id,user_id,created_at",
      created_at: `gte.${from}`,
      order: "created_at.desc",
      limit: 200,
    },
    { ttl: 60 },
  );
  const summary = aggregate(period, rows);
  void kvSet(kvKey(scope, period), summary);
  return summary;
}

/**
 * Read a pre-computed summary. Returns instantly from the stored row and
 * refreshes in the background when the stored value is older than the TTL.
 */
export async function getSummary(scope: "daily" | "monthly", period?: string): Promise<PeriodSummary> {
  const key = period ?? (scope === "daily" ? dayKey() : monthKey());
  const stored = await kvGet<PeriodSummary>(kvKey(scope, key));
  const ttl = scope === "daily" ? DAILY_TTL : MONTHLY_TTL;
  if (stored && Date.now() - (stored.computedAt ?? 0) < ttl) return stored;
  if (stored) {
    runInBackground(() => computeAndStore(scope, key));
    return stored;
  }
  return computeAndStore(scope, key);
}

/** Run work when the browser is idle so it never blocks a user interaction. */
export function runInBackground(job: () => Promise<unknown>) {
  const start = () => {
    void job().catch(() => {});
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (typeof idle === "function") idle(start, { timeout: 4000 });
  else setTimeout(start, 1200);
}

/** Kick off both summaries in the background (called from the admin shell). */
export function warmAnalytics() {
  if (typeof window === "undefined") return;
  runInBackground(async () => {
    await getSummary("daily");
    await getSummary("monthly");
  });
}
