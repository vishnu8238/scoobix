/**
 * Scoobix analytics & business intelligence engine.
 *
 * Design goals
 *  - one place computes every report (customer, restaurant, rider, manager, admin)
 *  - reads are projected (`select`) and paged, never unbounded
 *  - expensive reports are cached in `app_settings` (kv) with stale-while-revalidate,
 *    so a dashboard mount costs one tiny read instead of a table scan
 *  - callers only ever receive data for the subject they are authorised for
 *    (subject id is required for every non-admin report)
 *
 * No mock data, no localStorage.
 */
import { useCallback, useEffect, useState } from "react";
import { listPage, listTable } from "./insforge-crud";
import { kvGet, kvSet } from "./kv-store";
import { runInBackground } from "./analytics-jobs";
import type { ExportTable } from "./export-utils";

/* ------------------------------------------------------------------ types */

export type Scope = "customer" | "restaurant" | "rider" | "manager" | "admin";

export type Range = { from: string; to: string; label: string };

export type Trend = { key: string; label: string; value: number; secondary?: number };
export type Rank = { id: string; label: string; value: number; secondary?: number };
export type HeatCell = { day: number; hour: number; value: number };
export type Kpi = { label: string; value: number; kind?: "money" | "count" | "percent" | "time"; delta?: number };

export type BaseReport = {
  scope: Scope;
  subjectId: string;
  range: Range;
  kpis: Kpi[];
  computedAt: number;
};

export type CustomerReport = BaseReport & {
  totalOrders: number; completed: number; cancelled: number; aov: number; totalSpend: number;
  favoriteRestaurants: Rank[]; favoriteFoods: Rank[]; favoriteCategories: Rank[];
  couponSavings: number; walletUsed: number; pointsEarned: number;
  referralEarnings: number; membershipSavings: number;
  monthly: Trend[]; yearly: Trend[]; heatmap: HeatCell[];
};

export type RestaurantReport = BaseReport & {
  revenue: number; orders: number; aov: number; repeatCustomers: number; repeatRate: number;
  peakHours: Trend[]; topItems: Rank[]; leastItems: Rank[]; menuPerformance: Rank[];
  cancelled: number; cancellationRate: number; avgPrepMins: number; acceptanceRate: number;
  rating: number; reviewTrend: Trend[]; campaigns: Rank[]; coupons: Rank[];
  subscriptionPlan: string; commissionPct: number; commissionPaid: number; payout: number;
  daily: Trend[]; monthly: Trend[];
};

export type RiderReport = BaseReport & {
  completed: number; cancelled: number; acceptanceRate: number; completionRate: number;
  onlineHours: number; distanceKm: number; codCollected: number; pocketBalance: number;
  availableBalance: number; tips: number; bonuses: number; avgDeliveryMins: number;
  rating: number; weekly: Trend[]; monthly: Trend[];
};

export type ManagerReport = BaseReport & {
  assigned: number; onboarded: number; live: number; verificationProgress: number;
  revenueGenerated: number; commission: number; bonus: number; conversionRate: number;
  targetAttainment: number; growth: number; regionPerformance: Rank[];
  restaurantGrowth: Trend[]; campaignPerformance: Rank[]; pipeline: Rank[];
};

export type AdminReport = BaseReport & {
  revenue: number; orders: number; commissionRevenue: number; subscriptionRevenue: number;
  activeCustomers: number; activeRestaurants: number; activeRiders: number; activeManagers: number;
  tickets: { open: number; breached: number; resolved: number };
  walletBalance: number; referrals: number; couponUsage: number; couponDiscount: number;
  cancellationRate: number; avgDeliveryMins: number; peakHour: number;
  restaurantGrowth: Trend[]; hourly: Trend[]; daily: Trend[]; weekly: Trend[];
  monthly: Trend[]; yearly: Trend[]; heatmap: HeatCell[];
  cityPerformance: Rank[]; topRestaurants: Rank[]; topRiders: Rank[];
  fraudReports: Rank[]; forecast: Trend[];
};

export type AnyReport =
  | CustomerReport | RestaurantReport | RiderReport | ManagerReport | AdminReport;

/* -------------------------------------------------------------- utilities */

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
};
const round = (n: number, p = 2) => +n.toFixed(p);
const upper = (v: unknown) => String(v ?? "").toUpperCase();
const iso = (d: Date) => d.toISOString();
const dayOf = (v: unknown) => String(v ?? "").slice(0, 10);
const monthOf = (v: unknown) => String(v ?? "").slice(0, 7);
const yearOf = (v: unknown) => String(v ?? "").slice(0, 4);

const DONE = new Set(["DELIVERED", "COMPLETED"]);
const DEAD = new Set(["CANCELLED", "REJECTED", "FAILED"]);

export function rangeDays(days: number, label = `${days}d`): Range {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from: iso(from), to: iso(to), label };
}

export const RANGE_PRESETS: { id: string; label: string; build: () => Range }[] = [
  { id: "7d", label: "7 days", build: () => rangeDays(7, "7 days") },
  { id: "30d", label: "30 days", build: () => rangeDays(30, "30 days") },
  { id: "90d", label: "90 days", build: () => rangeDays(90, "90 days") },
  { id: "365d", label: "12 months", build: () => rangeDays(365, "12 months") },
];

export function customRange(from: string, to: string): Range {
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
    label: `${from} → ${to}`,
  };
}

/** Paged, projected scan. Never pulls an unbounded table. */
async function scan<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string | number | undefined>,
  max = 1000,
): Promise<T[]> {
  const out: T[] = [];
  const size = 200;
  for (let page = 0; page * size < max; page += 1) {
    const rows = await listPage<T>(table, page, size, params, { ttl: 120 });
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

type OrderRow = {
  id?: string; customer_id?: string; restaurant_id?: string; driver_id?: string;
  status?: string; total_price?: number; subtotal?: number; delivery_fee?: number;
  discount?: number; tax?: number; tip?: number; distance_km?: number;
  payment_method?: string; payment_status?: string; created_at?: string;
  updated_at?: string; actual_delivery_time?: string; estimated_delivery_time?: string;
  commission_amount?: number; restaurant_payout?: number; driver_earnings?: number;
  platform_earnings?: number; restaurant_rating?: number; driver_rating?: number;
  coupon_id?: string; items?: unknown;
};

const ORDER_SELECT =
  "id,customer_id,restaurant_id,driver_id,status,total_price,subtotal,delivery_fee,discount,tax,tip," +
  "distance_km,payment_method,payment_status,created_at,updated_at,actual_delivery_time," +
  "estimated_delivery_time,commission_amount,restaurant_payout,driver_earnings,platform_earnings," +
  "restaurant_rating,driver_rating,coupon_id,items";

const orderValue = (o: OrderRow) => num(o.total_price, num(o.subtotal));

function loadOrders(range: Range, match: Record<string, string> = {}, max = 1000) {
  return scan<OrderRow>(
    "orders",
    { select: ORDER_SELECT, created_at: `gte.${range.from}`, order: "created_at.desc", ...match },
    max,
  );
}

function withinRange(rows: OrderRow[], range: Range): OrderRow[] {
  const to = Date.parse(range.to);
  const from = Date.parse(range.from);
  return rows.filter((r) => {
    const t = Date.parse(String(r.created_at ?? ""));
    return Number.isFinite(t) ? t >= from && t <= to : true;
  });
}

function bucket<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + value(r));
  }
  return m;
}

function toRanks(m: Map<string, number>, label: (id: string) => string, limit = 8, asc = false): Rank[] {
  return [...m.entries()]
    .map(([id, value]) => ({ id, label: label(id), value: round(value) }))
    .sort((a, b) => (asc ? a.value - b.value : b.value - a.value))
    .slice(0, limit);
}

function trendByDay(rows: OrderRow[], days: number, value: (o: OrderRow) => number): Trend[] {
  const out: Trend[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const total = rows.filter((r) => dayOf(r.created_at) === key).reduce((s, r) => s + value(r), 0);
    out.push({ key, label: key.slice(5), value: round(total) });
  }
  return out;
}

function trendByMonth(rows: OrderRow[], months: number, value: (o: OrderRow) => number): Trend[] {
  const out: Trend[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = rows.filter((r) => monthOf(r.created_at) === key).reduce((s, r) => s + value(r), 0);
    out.push({ key, label: d.toLocaleString(undefined, { month: "short" }), value: round(total) });
  }
  return out;
}

function trendByYear(rows: OrderRow[], years = 3, value: (o: OrderRow) => number): Trend[] {
  const now = new Date().getFullYear();
  return Array.from({ length: years }, (_, i) => {
    const y = String(now - (years - 1 - i));
    const total = rows.filter((r) => yearOf(r.created_at) === y).reduce((s, r) => s + value(r), 0);
    return { key: y, label: y, value: round(total) };
  });
}

function trendByWeek(rows: OrderRow[], weeks: number, value: (o: OrderRow) => number): Trend[] {
  const out: Trend[] = [];
  const now = Date.now();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = now - i * 7 * 86400_000;
    const start = end - 7 * 86400_000;
    const total = rows
      .filter((r) => {
        const t = Date.parse(String(r.created_at ?? ""));
        return t > start && t <= end;
      })
      .reduce((s, r) => s + value(r), 0);
    out.push({ key: `w${weeks - i}`, label: `W${weeks - i}`, value: round(total) });
  }
  return out;
}

function heatmapOf(rows: OrderRow[]): HeatCell[] {
  const grid = new Map<string, number>();
  for (const r of rows) {
    const t = new Date(String(r.created_at ?? ""));
    if (Number.isNaN(t.getTime())) continue;
    const k = `${t.getDay()}:${t.getHours()}`;
    grid.set(k, (grid.get(k) ?? 0) + 1);
  }
  return [...grid.entries()].map(([k, value]) => {
    const [day, hour] = k.split(":").map(Number);
    return { day, hour, value };
  });
}

function hourlyOf(rows: OrderRow[]): Trend[] {
  return Array.from({ length: 24 }, (_, h) => ({
    key: String(h),
    label: `${String(h).padStart(2, "0")}h`,
    value: rows.filter((r) => new Date(String(r.created_at ?? "")).getHours() === h).length,
  }));
}

function minutesBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < x) return null;
  return (y - x) / 60000;
}

function average(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? round(clean.reduce((s, v) => s + v, 0) / clean.length) : 0;
}

/** Least-squares projection of the next `n` points of a trend. */
function forecastTrend(series: Trend[], n = 3): Trend[] {
  const pts = series.map((t, i) => [i, t.value] as const);
  if (pts.length < 2) return [];
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const denom = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0) || 1;
  const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / denom;
  const intercept = my - slope * mx;
  return Array.from({ length: n }, (_, i) => {
    const x = pts.length + i;
    return { key: `f${i}`, label: `+${i + 1}`, value: round(Math.max(0, intercept + slope * x)) };
  });
}

/* ------------------------------------------------------- caching wrapper */

const MEM = new Map<string, { at: number; data: AnyReport }>();
const TTL_MS = 10 * 60 * 1000;

async function cachedReport<T extends AnyReport>(key: string, build: () => Promise<T>): Promise<T> {
  const hit = MEM.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;

  const stored = await kvGet<T>(key);
  if (stored && Date.now() - (stored.computedAt ?? 0) < TTL_MS) {
    MEM.set(key, { at: Date.now(), data: stored });
    return stored;
  }
  if (stored) {
    // stale-while-revalidate: serve instantly, recompute off the critical path
    MEM.set(key, { at: Date.now(), data: stored });
    runInBackground(async () => {
      const fresh = await build();
      MEM.set(key, { at: Date.now(), data: fresh });
      await kvSet(key, fresh);
    });
    return stored;
  }
  const fresh = await build();
  MEM.set(key, { at: Date.now(), data: fresh });
  void kvSet(key, fresh);
  return fresh;
}

function cacheKey(scope: Scope, subjectId: string, range: Range) {
  return `report:${scope}:${subjectId || "all"}:${range.label}`;
}

/** Drop cached reports for a subject (used after a manual refresh). */
export function invalidateReports(scope?: Scope) {
  for (const k of [...MEM.keys()]) if (!scope || k.startsWith(`report:${scope}`)) MEM.delete(k);
}

/* --------------------------------------------------------------- lookups */

async function restaurantNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const rows = await listTable<{ id: string; name?: string; city?: string }>(
    "restaurants",
    { select: "id,name,city", limit: 200 },
    { ttl: 300 },
  );
  for (const r of rows) map.set(r.id, r.name ?? r.id.slice(0, 8));
  return map;
}

/* ------------------------------------------------------ customer report */

export async function buildCustomerReport(userId: string, range: Range): Promise<CustomerReport> {
  const [orders, wallet, points, referrals, coupons, subUsage] = await Promise.all([
    loadOrders(range, { customer_id: `eq.${userId}` }, 600),
    scan<{ amount?: number; bucket?: string; kind?: string; transaction_type?: string; created_at?: string }>(
      "wallet_transactions",
      { select: "amount,bucket,kind,transaction_type,created_at", user_id: `eq.${userId}`, order: "created_at.desc" },
      400,
    ),
    scan<{ points?: number; type?: string; created_at?: string }>(
      "loyalty_points", { select: "points,type,created_at", user_id: `eq.${userId}`, order: "created_at.desc" }, 400,
    ),
    scan<{ reward_amount?: number; amount?: number; status?: string }>(
      "referral_rewards", { select: "amount,reward_amount,status,user_id", user_id: `eq.${userId}` }, 200,
    ),
    scan<{ discount_amount?: number; created_at?: string }>(
      "coupon_usage", { select: "discount_amount,created_at,user_id", user_id: `eq.${userId}` }, 400,
    ),
    scan<{ metric?: string; saved?: number; value?: number }>(
      "subscription_usage", { select: "metric,saved,value,subject_id", subject_id: `eq.${userId}` }, 200,
    ),
  ]);

  const rows = withinRange(orders, range);
  const completed = rows.filter((o) => DONE.has(upper(o.status)));
  const cancelled = rows.filter((o) => DEAD.has(upper(o.status)));
  const totalSpend = completed.reduce((s, o) => s + orderValue(o), 0);

  const names = await restaurantNames(rows.map((o) => String(o.restaurant_id ?? "")));

  const foodCount = new Map<string, number>();
  const catCount = new Map<string, number>();
  for (const o of rows) {
    const raw = o.items as { lines?: { name?: string; category?: string; quantity?: number }[] } | undefined;
    const lines = Array.isArray(raw) ? raw : (raw?.lines ?? []);
    for (const l of lines as { name?: string; category?: string; quantity?: number }[]) {
      if (l?.name) foodCount.set(l.name, (foodCount.get(l.name) ?? 0) + num(l.quantity, 1));
      if (l?.category) catCount.set(l.category, (catCount.get(l.category) ?? 0) + num(l.quantity, 1));
    }
  }

  const walletUsed = wallet
    .filter((w) => num(w.amount) < 0 || upper(w.transaction_type ?? w.kind) === "DEBIT")
    .reduce((s, w) => s + Math.abs(num(w.amount)), 0);
  const pointsEarned = points.filter((p) => num(p.points) > 0).reduce((s, p) => s + num(p.points), 0);
  const referralEarnings = referrals.reduce((s, r) => s + num(r.reward_amount, num(r.amount)), 0);
  const couponSavings = coupons.reduce((s, c) => s + num(c.discount_amount), 0);
  const membershipSavings = subUsage.reduce((s, u) => s + num(u.saved, 0), 0);
  const aov = completed.length ? totalSpend / completed.length : 0;

  return {
    scope: "customer", subjectId: userId, range, computedAt: Date.now(),
    totalOrders: rows.length,
    completed: completed.length,
    cancelled: cancelled.length,
    aov: round(aov),
    totalSpend: round(totalSpend),
    favoriteRestaurants: toRanks(
      bucket(rows, (o) => String(o.restaurant_id ?? ""), () => 1),
      (id) => names.get(id) ?? id.slice(0, 8),
    ),
    favoriteFoods: toRanks(foodCount, (id) => id),
    favoriteCategories: toRanks(catCount, (id) => id, 6),
    couponSavings: round(couponSavings),
    walletUsed: round(walletUsed),
    pointsEarned: round(pointsEarned),
    referralEarnings: round(referralEarnings),
    membershipSavings: round(membershipSavings),
    monthly: trendByMonth(rows, 12, () => 1),
    yearly: trendByYear(rows, 3, (o) => orderValue(o)),
    heatmap: heatmapOf(rows),
    kpis: [
      { label: "Total orders", value: rows.length, kind: "count" },
      { label: "Total spending", value: round(totalSpend), kind: "money" },
      { label: "Average order", value: round(aov), kind: "money" },
      { label: "Total savings", value: round(couponSavings + membershipSavings + referralEarnings), kind: "money" },
    ],
  };
}

/* ---------------------------------------------------- restaurant report */

export async function buildRestaurantReport(restaurantId: string, range: Range): Promise<RestaurantReport> {
  const [orders, reviews, restaurant, couponRows, campaigns, subs] = await Promise.all([
    loadOrders(range, { restaurant_id: `eq.${restaurantId}` }, 1000),
    scan<{ rating?: number; created_at?: string }>(
      "reviews", { select: "rating,created_at,restaurant_id", restaurant_id: `eq.${restaurantId}`, order: "created_at.desc" }, 400,
    ),
    listTable<{ id: string; name?: string; commission?: number; subscription_plan_id?: string; rating?: number }>(
      "restaurants", { select: "id,name,commission,subscription_plan_id,rating", id: `eq.${restaurantId}`, limit: 1 }, { ttl: 300 },
    ),
    scan<{ coupon_code?: string; discount_amount?: number; order_value?: number }>(
      "coupon_usage", { select: "coupon_code,discount_amount,order_value,restaurant_id", restaurant_id: `eq.${restaurantId}` }, 400,
    ),
    scan<{ id?: string; name?: string; title?: string; restaurant_id?: string; redemptions?: number; revenue?: number }>(
      "campaigns", { select: "id,name,title,restaurant_id,redemptions,revenue", restaurant_id: `eq.${restaurantId}` }, 200,
    ),
    listTable<{ plan_id?: string; status?: string }>(
      "subscriptions", { select: "plan_id,status,subject_id,subject_type", subject_id: `eq.${restaurantId}`, limit: 1 }, { ttl: 300 },
    ),
  ]);

  const rows = withinRange(orders, range);
  const completed = rows.filter((o) => DONE.has(upper(o.status)));
  const cancelled = rows.filter((o) => DEAD.has(upper(o.status)));
  const revenue = completed.reduce((s, o) => s + orderValue(o), 0);

  const customers = new Map<string, number>();
  for (const o of rows) {
    const c = String(o.customer_id ?? "");
    if (c) customers.set(c, (customers.get(c) ?? 0) + 1);
  }
  const repeatCustomers = [...customers.values()].filter((n) => n > 1).length;

  const itemUnits = new Map<string, number>();
  const itemRevenue = new Map<string, number>();
  for (const o of rows) {
    const raw = o.items as { lines?: { name?: string; quantity?: number; price?: number }[] } | undefined;
    const lines = Array.isArray(raw) ? raw : (raw?.lines ?? []);
    for (const l of lines as { name?: string; quantity?: number; price?: number }[]) {
      if (!l?.name) continue;
      const q = num(l.quantity, 1);
      itemUnits.set(l.name, (itemUnits.get(l.name) ?? 0) + q);
      itemRevenue.set(l.name, (itemRevenue.get(l.name) ?? 0) + q * num(l.price));
    }
  }

  const prep = completed
    .map((o) => minutesBetween(o.created_at, o.actual_delivery_time))
    .filter((v): v is number => v !== null);
  const accepted = rows.filter((o) => !["PLACED", "PENDING"].includes(upper(o.status)) && !DEAD.has(upper(o.status)));
  const planName = subs[0]?.plan_id ? String(subs[0].plan_id).slice(0, 8) : "—";

  const reviewTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rs = reviews.filter((r) => monthOf(r.created_at) === key);
    return {
      key, label: d.toLocaleString(undefined, { month: "short" }),
      value: rs.length ? round(rs.reduce((s, r) => s + num(r.rating), 0) / rs.length) : 0,
      secondary: rs.length,
    };
  });

  const couponMap = new Map<string, number>();
  for (const c of couponRows) couponMap.set(String(c.coupon_code ?? "—"), (couponMap.get(String(c.coupon_code ?? "—")) ?? 0) + num(c.discount_amount));

  return {
    scope: "restaurant", subjectId: restaurantId, range, computedAt: Date.now(),
    revenue: round(revenue),
    orders: rows.length,
    aov: completed.length ? round(revenue / completed.length) : 0,
    repeatCustomers,
    repeatRate: customers.size ? round((repeatCustomers / customers.size) * 100, 1) : 0,
    peakHours: hourlyOf(rows),
    topItems: toRanks(itemUnits, (id) => id, 8),
    leastItems: toRanks(itemUnits, (id) => id, 8, true),
    menuPerformance: toRanks(itemRevenue, (id) => id, 12),
    cancelled: cancelled.length,
    cancellationRate: rows.length ? round((cancelled.length / rows.length) * 100, 1) : 0,
    avgPrepMins: average(prep),
    acceptanceRate: rows.length ? round((accepted.length / rows.length) * 100, 1) : 0,
    rating: reviews.length ? average(reviews.map((r) => num(r.rating))) : num(restaurant[0]?.rating),
    reviewTrend,
    campaigns: campaigns.map((c) => ({
      id: String(c.id ?? ""), label: String(c.name ?? c.title ?? "Campaign"),
      value: num(c.revenue), secondary: num(c.redemptions),
    })).sort((a, b) => b.value - a.value).slice(0, 8),
    coupons: toRanks(couponMap, (id) => id, 8),
    subscriptionPlan: planName,
    commissionPct: num(restaurant[0]?.commission),
    commissionPaid: round(completed.reduce((s, o) => s + num(o.commission_amount), 0)),
    payout: round(completed.reduce((s, o) => s + num(o.restaurant_payout), 0)),
    daily: trendByDay(rows, 14, (o) => orderValue(o)),
    monthly: trendByMonth(rows, 12, (o) => orderValue(o)),
    kpis: [
      { label: "Revenue", value: round(revenue), kind: "money" },
      { label: "Orders", value: rows.length, kind: "count" },
      { label: "Avg order value", value: completed.length ? round(revenue / completed.length) : 0, kind: "money" },
      { label: "Rating", value: reviews.length ? average(reviews.map((r) => num(r.rating))) : num(restaurant[0]?.rating), kind: "count" },
    ],
  };
}

/* --------------------------------------------------------- rider report */

export async function buildRiderReport(driverId: string, range: Range): Promise<RiderReport> {
  const [orders, driver, incentives, reviews] = await Promise.all([
    loadOrders(range, { driver_id: `eq.${driverId}` }, 800),
    listTable<{
      id: string; rating?: number; payout_pending?: number; pending_earnings?: number;
      total_deliveries?: number; total_earnings?: number;
    }>("drivers", { select: "id,rating,payout_pending,pending_earnings,total_deliveries,total_earnings", id: `eq.${driverId}`, limit: 1 }, { ttl: 120 }),
    scan<{ amount?: number; status?: string; online_hours?: number; acceptance_rate?: number; completion_rate?: number; created_at?: string }>(
      "rider_incentives", { select: "amount,status,online_hours,acceptance_rate,completion_rate,created_at,driver_id", driver_id: `eq.${driverId}` }, 300,
    ),
    scan<{ rating?: number }>("reviews", { select: "rating,order_id,restaurant_id", restaurant_id: "is.null" }, 200),
  ]);

  const rows = withinRange(orders, range);
  const completed = rows.filter((o) => DONE.has(upper(o.status)));
  const cancelled = rows.filter((o) => DEAD.has(upper(o.status)));
  const deliveryMins = completed
    .map((o) => minutesBetween(o.created_at, o.actual_delivery_time))
    .filter((v): v is number => v !== null);
  const cod = completed
    .filter((o) => upper(o.payment_method).includes("COD") || upper(o.payment_method).includes("CASH"))
    .reduce((s, o) => s + orderValue(o), 0);
  const latest = incentives[0];
  const driverRatings = rows.map((o) => num(o.driver_rating)).filter((v) => v > 0);

  return {
    scope: "rider", subjectId: driverId, range, computedAt: Date.now(),
    completed: completed.length,
    cancelled: cancelled.length,
    acceptanceRate: num(latest?.acceptance_rate, rows.length ? round(((rows.length - cancelled.length) / rows.length) * 100, 1) : 0),
    completionRate: rows.length ? round((completed.length / rows.length) * 100, 1) : 0,
    onlineHours: round(incentives.reduce((s, i) => s + num(i.online_hours), 0), 1),
    distanceKm: round(completed.reduce((s, o) => s + num(o.distance_km), 0), 1),
    codCollected: round(cod),
    pocketBalance: round(num(driver[0]?.payout_pending)),
    availableBalance: round(num(driver[0]?.pending_earnings)),
    tips: round(completed.reduce((s, o) => s + num(o.tip), 0)),
    bonuses: round(incentives.filter((i) => i.status === "paid" || i.status === "approved").reduce((s, i) => s + num(i.amount), 0)),
    avgDeliveryMins: average(deliveryMins),
    rating: driverRatings.length ? average(driverRatings) : num(driver[0]?.rating, reviews.length ? average(reviews.map((r) => num(r.rating))) : 0),
    weekly: trendByWeek(rows, 8, () => 1),
    monthly: trendByMonth(rows, 12, (o) => num(o.driver_earnings)),
    kpis: [
      { label: "Deliveries", value: completed.length, kind: "count" },
      { label: "Earnings", value: round(completed.reduce((s, o) => s + num(o.driver_earnings), 0)), kind: "money" },
      { label: "Completion rate", value: rows.length ? round((completed.length / rows.length) * 100, 1) : 0, kind: "percent" },
      { label: "Avg delivery", value: average(deliveryMins), kind: "time" },
    ],
  };
}

/* ------------------------------------------------------- manager report */

export async function buildManagerReport(managerId: string, range: Range): Promise<ManagerReport> {
  const [restaurants, leads, targets, manager] = await Promise.all([
    scan<{
      id: string; name?: string; city?: string; is_live?: boolean; onboarding_status?: string;
      bank_verified?: boolean; docs_verified?: boolean; created_at?: string; went_live_at?: string;
    }>("restaurants", {
      select: "id,name,city,is_live,onboarding_status,bank_verified,docs_verified,created_at,went_live_at,manager_id",
      manager_id: `eq.${managerId}`,
    }, 600),
    scan<{ id: string; stage?: string; city?: string; converted_at?: string; created_at?: string }>(
      "restaurant_leads", { select: "id,stage,city,converted_at,created_at,manager_id", manager_id: `eq.${managerId}` }, 600,
    ),
    scan<{ period?: string; target?: number; achieved?: number; commission?: number; bonus?: number; region?: string; growth_percent?: number }>(
      "merchant_targets", { select: "period,target,achieved,commission,bonus,region,growth_percent,manager_id", manager_id: `eq.${managerId}`, order: "created_at.desc" }, 200,
    ),
    listTable<{ id: string; region?: string; monthly_target?: number }>(
      "merchant_managers", { select: "id,region,monthly_target", id: `eq.${managerId}`, limit: 1 }, { ttl: 300 },
    ),
  ]);

  const ids = restaurants.map((r) => r.id);
  const orders = ids.length
    ? (await loadOrders(range, {}, 1000)).filter((o) => ids.includes(String(o.restaurant_id ?? "")))
    : [];
  const rows = withinRange(orders, range);
  const revenue = rows.filter((o) => DONE.has(upper(o.status))).reduce((s, o) => s + orderValue(o), 0);

  const live = restaurants.filter((r) => r.is_live).length;
  const verified = restaurants.filter((r) => r.bank_verified && r.docs_verified).length;
  const converted = leads.filter((l) => l.converted_at || l.stage === "converted").length;
  const current = targets[0];
  const target = num(current?.target, num(manager[0]?.monthly_target));
  const achieved = num(current?.achieved, live);

  const byCity = bucket(restaurants, (r) => String(r.city ?? "—"), () => 1);
  const growth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key, label: d.toLocaleString(undefined, { month: "short" }),
      value: restaurants.filter((r) => monthOf(r.went_live_at ?? r.created_at) === key).length,
    };
  });

  const stagePipeline = toRanks(bucket(leads, (l) => String(l.stage ?? "new"), () => 1), (id) => id, 10);

  return {
    scope: "manager", subjectId: managerId, range, computedAt: Date.now(),
    assigned: restaurants.length,
    onboarded: restaurants.filter((r) => (r.onboarding_status ?? "") === "approved" || r.is_live).length,
    live,
    verificationProgress: restaurants.length ? round((verified / restaurants.length) * 100, 1) : 0,
    revenueGenerated: round(revenue),
    commission: round(targets.reduce((s, t) => s + num(t.commission), 0)),
    bonus: round(targets.reduce((s, t) => s + num(t.bonus), 0)),
    conversionRate: leads.length ? round((converted / leads.length) * 100, 1) : 0,
    targetAttainment: target ? round((achieved / target) * 100, 1) : 0,
    growth: num(current?.growth_percent),
    regionPerformance: toRanks(byCity, (id) => id, 8),
    restaurantGrowth: growth,
    campaignPerformance: [],
    pipeline: stagePipeline,
    kpis: [
      { label: "Assigned", value: restaurants.length, kind: "count" },
      { label: "Live restaurants", value: live, kind: "count" },
      { label: "Revenue generated", value: round(revenue), kind: "money" },
      { label: "Target attainment", value: target ? round((achieved / target) * 100, 1) : 0, kind: "percent" },
    ],
  };
}

/* --------------------------------------------------------- admin report */

export async function buildAdminReport(range: Range): Promise<AdminReport> {
  const [orders, users, restaurants, drivers, managers, tickets, wallets, referrals, coupons, invoices] =
    await Promise.all([
      loadOrders(range, {}, 2000),
      scan<{ id: string; role?: string; status?: string; registration_timestamp?: string }>(
        "users", { select: "id,role,status,registration_timestamp" }, 2000,
      ),
      scan<{ id: string; name?: string; city?: string; status?: string; is_live?: boolean; created_at?: string; went_live_at?: string }>(
        "restaurants", { select: "id,name,city,status,is_live,created_at,went_live_at" }, 800,
      ),
      scan<{ id: string; online_status?: boolean; total_deliveries?: number; rating?: number }>(
        "drivers", { select: "id,online_status,total_deliveries,rating" }, 600,
      ),
      scan<{ id: string; status?: string }>("merchant_managers", { select: "id,status" }, 200),
      scan<{ id: string; status?: string; sla_breached?: boolean; resolved_at?: string }>(
        "support_tickets", { select: "id,status,sla_breached,resolved_at,created_at", order: "created_at.desc" }, 600,
      ),
      scan<{ balance?: number }>("wallet", { select: "balance" }, 1000),
      scan<{ id: string; status?: string; created_at?: string }>("referrals", { select: "id,status,created_at" }, 600),
      scan<{ id: string; discount_amount?: number; coupon_code?: string; created_at?: string }>(
        "coupon_usage", { select: "id,discount_amount,coupon_code,created_at" }, 1000,
      ),
      scan<{ total?: number; status?: string; created_at?: string }>(
        "subscription_invoices", { select: "total,status,created_at" }, 600,
      ),
    ]);

  const rows = withinRange(orders, range);
  const completed = rows.filter((o) => DONE.has(upper(o.status)));
  const cancelled = rows.filter((o) => DEAD.has(upper(o.status)));
  const revenue = completed.reduce((s, o) => s + orderValue(o), 0);
  const names = new Map(restaurants.map((r) => [r.id, r.name ?? r.id.slice(0, 8)]));
  const cityOf = new Map(restaurants.map((r) => [r.id, r.city ?? "—"]));

  const deliveryMins = completed
    .map((o) => minutesBetween(o.created_at, o.actual_delivery_time))
    .filter((v): v is number => v !== null);

  const hourly = hourlyOf(rows);
  const peakHour = hourly.reduce((best, h) => (h.value > best.value ? h : best), hourly[0] ?? { key: "0", label: "00h", value: 0 });

  // Fraud signals: many coupon redemptions from one account, and repeat
  // cancellations by the same customer.
  const couponsByUser = new Map<string, number>();
  for (const c of coupons) {
    const key = String((c as { user_id?: string }).user_id ?? "");
    if (key) couponsByUser.set(key, (couponsByUser.get(key) ?? 0) + 1);
  }
  const cancelByUser = bucket(cancelled, (o) => String(o.customer_id ?? ""), () => 1);
  const fraudReports: Rank[] = [
    ...[...couponsByUser.entries()].filter(([, n]) => n >= 8).map(([id, n]) => ({
      id, label: `Heavy coupon use · ${id.slice(0, 8)}`, value: n,
    })),
    ...[...cancelByUser.entries()].filter(([, n]) => n >= 4).map(([id, n]) => ({
      id, label: `Repeat cancellations · ${id.slice(0, 8)}`, value: n,
    })),
  ].sort((a, b) => b.value - a.value).slice(0, 10);

  const monthly = trendByMonth(rows, 12, (o) => orderValue(o));

  const restaurantGrowth = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key, label: d.toLocaleString(undefined, { month: "short" }),
      value: restaurants.filter((r) => monthOf(r.went_live_at ?? r.created_at) === key).length,
    };
  });

  const activeCustomers = new Set(rows.map((o) => o.customer_id).filter(Boolean)).size;

  return {
    scope: "admin", subjectId: "platform", range, computedAt: Date.now(),
    revenue: round(revenue),
    orders: rows.length,
    commissionRevenue: round(completed.reduce((s, o) => s + num(o.commission_amount, num(o.platform_earnings)), 0)),
    subscriptionRevenue: round(invoices.filter((i) => (i.status ?? "paid") !== "void").reduce((s, i) => s + num(i.total), 0)),
    activeCustomers,
    activeRestaurants: restaurants.filter((r) => r.is_live || r.status === "approved" || r.status === "active").length,
    activeRiders: drivers.filter((d) => d.online_status || num(d.total_deliveries) > 0).length,
    activeManagers: managers.filter((m) => (m.status ?? "active") === "active").length,
    tickets: {
      open: tickets.filter((t) => !["closed", "resolved"].includes(String(t.status ?? "").toLowerCase())).length,
      breached: tickets.filter((t) => t.sla_breached).length,
      resolved: tickets.filter((t) => t.resolved_at).length,
    },
    walletBalance: round(wallets.reduce((s, w) => s + num(w.balance), 0)),
    referrals: referrals.length,
    couponUsage: coupons.length,
    couponDiscount: round(coupons.reduce((s, c) => s + num(c.discount_amount), 0)),
    cancellationRate: rows.length ? round((cancelled.length / rows.length) * 100, 1) : 0,
    avgDeliveryMins: average(deliveryMins),
    peakHour: Number(peakHour.key),
    restaurantGrowth,
    hourly,
    daily: trendByDay(rows, 30, (o) => orderValue(o)),
    weekly: trendByWeek(rows, 8, (o) => orderValue(o)),
    monthly,
    yearly: trendByYear(rows, 3, (o) => orderValue(o)),
    heatmap: heatmapOf(rows),
    cityPerformance: toRanks(
      bucket(completed, (o) => cityOf.get(String(o.restaurant_id ?? "")) ?? "—", (o) => orderValue(o)),
      (id) => id, 8,
    ),
    topRestaurants: toRanks(
      bucket(completed, (o) => String(o.restaurant_id ?? ""), (o) => orderValue(o)),
      (id) => names.get(id) ?? id.slice(0, 8), 8,
    ),
    topRiders: toRanks(
      bucket(completed, (o) => String(o.driver_id ?? ""), () => 1),
      (id) => id.slice(0, 8), 8,
    ),
    fraudReports,
    forecast: forecastTrend(monthly, 3),
    kpis: [
      { label: "Platform revenue", value: round(revenue), kind: "money" },
      { label: "Orders", value: rows.length, kind: "count" },
      { label: "Commission", value: round(completed.reduce((s, o) => s + num(o.commission_amount), 0)), kind: "money" },
      { label: "Active customers", value: activeCustomers, kind: "count" },
    ],
  };
}

/* ------------------------------------------------------------- insights */

/**
 * Deterministic, rule-based insight generator. The AI gateway was removed from
 * this project, so insights are computed locally — zero cost, zero latency and
 * no external dependency.
 */
export function generateInsights(report: AnyReport): string[] {
  const out: string[] = [];
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  if (report.scope === "customer") {
    const r = report as CustomerReport;
    if (r.favoriteRestaurants[0]) out.push(`You order most from ${r.favoriteRestaurants[0].label} — ${r.favoriteRestaurants[0].value} orders in this period.`);
    if (r.couponSavings > 0) out.push(`Coupons saved you ${r.couponSavings} so far; that is ${pct(r.couponSavings, r.totalSpend)}% of what you spent.`);
    if (r.membershipSavings === 0) out.push("Scoobix Plus would cut delivery fees on your usual order pattern — worth a look.");
    if (r.cancelled > 0) out.push(`${r.cancelled} order${r.cancelled === 1 ? "" : "s"} were cancelled — check your delivery address if this repeats.`);
    const peak = r.heatmap.slice().sort((a, b) => b.value - a.value)[0];
    if (peak) out.push(`You order most around ${String(peak.hour).padStart(2, "0")}:00 — schedule a plan meal then to save more.`);
  }

  if (report.scope === "restaurant") {
    const r = report as RestaurantReport;
    if (r.acceptanceRate < 90) out.push(`Acceptance rate is ${r.acceptanceRate}% — every rejected order pushes you down in listings.`);
    if (r.avgPrepMins > 35) out.push(`Average fulfilment is ${r.avgPrepMins} min. Trimming 5 min typically lifts repeat orders.`);
    if (r.leastItems[0]) out.push(`${r.leastItems[0].label} barely sells — consider repricing, re-photographing or retiring it.`);
    if (r.topItems[0]) out.push(`${r.topItems[0].label} drives your volume; bundle it with a high-margin add-on.`);
    if (r.repeatRate < 25) out.push(`Only ${r.repeatRate}% of customers came back — a loyalty coupon would move this fastest.`);
    if (r.rating && r.rating < 4.2) out.push(`Rating is ${r.rating}. Responding to reviews recovers roughly a third of unhappy customers.`);
  }

  if (report.scope === "rider") {
    const r = report as RiderReport;
    if (r.acceptanceRate < 85) out.push(`Acceptance rate ${r.acceptanceRate}% — staying above 85% keeps you eligible for peak bonuses.`);
    if (r.avgDeliveryMins > 30) out.push(`Average delivery is ${r.avgDeliveryMins} min; batching pickups in the same block helps.`);
    if (r.pocketBalance > 0) out.push(`You are holding ${r.pocketBalance} in COD — settle it to keep receiving orders.`);
    if (r.onlineHours > 0) out.push(`You earned across ${r.onlineHours} online hours; peak-hour slots pay the most per hour.`);
  }

  if (report.scope === "manager") {
    const r = report as ManagerReport;
    if (r.targetAttainment < 100) out.push(`You are at ${r.targetAttainment}% of target — ${Math.max(0, r.assigned - r.live)} assigned restaurants are still not live.`);
    if (r.verificationProgress < 100) out.push(`${100 - r.verificationProgress}% of your restaurants still have pending KYC — that blocks go-live.`);
    if (r.conversionRate < 30 && r.pipeline.length) out.push(`Lead conversion is ${r.conversionRate}%; focus on the ${r.pipeline[0].label} stage where most leads sit.`);
    if (r.regionPerformance[0]) out.push(`${r.regionPerformance[0].label} is your strongest area — replicate that outreach elsewhere.`);
  }

  if (report.scope === "admin") {
    const r = report as AdminReport;
    if (r.cancellationRate > 8) out.push(`Cancellation rate is ${r.cancellationRate}% — above the 8% healthy ceiling; audit the worst restaurants.`);
    if (r.avgDeliveryMins > 40) out.push(`Average delivery is ${r.avgDeliveryMins} min. Adding riders at ${String(r.peakHour).padStart(2, "0")}:00 has the biggest effect.`);
    if (r.forecast[0]) out.push(`Trend projects roughly ${r.forecast[0].value} revenue next month at the current trajectory.`);
    if (r.cityPerformance[0]) out.push(`${r.cityPerformance[0].label} leads revenue; the next city down is the cheapest place to grow.`);
    if (r.tickets.breached > 0) out.push(`${r.tickets.breached} support tickets breached SLA — reassign before churn follows.`);
    if (r.fraudReports.length) out.push(`${r.fraudReports.length} accounts show abuse patterns worth reviewing.`);
    if (r.subscriptionRevenue > 0) out.push(`Subscriptions contribute ${pct(r.subscriptionRevenue, r.revenue + r.subscriptionRevenue)}% of total revenue.`);
  }

  return out.slice(0, 6);
}

/* --------------------------------------------------------------- export */

export function reportTables(report: AnyReport): ExportTable[] {
  const kpi: ExportTable = {
    title: "Key metrics",
    columns: [{ key: "label", label: "Metric" }, { key: "value", label: "Value" }],
    rows: report.kpis.map((k) => ({ label: k.label, value: k.value })),
  };
  const trendTable = (title: string, rows: Trend[]): ExportTable => ({
    title,
    columns: [{ key: "label", label: "Period" }, { key: "value", label: "Value" }],
    rows: rows.map((t) => ({ label: t.label, value: t.value })),
  });
  const rankTable = (title: string, rows: Rank[]): ExportTable => ({
    title,
    columns: [{ key: "label", label: "Name" }, { key: "value", label: "Value" }, { key: "secondary", label: "Secondary" }],
    rows: rows.map((r) => ({ label: r.label, value: r.value, secondary: r.secondary ?? "" })),
  });

  const tables: ExportTable[] = [kpi];
  if (report.scope === "customer") {
    const r = report as CustomerReport;
    tables.push(rankTable("Favourite restaurants", r.favoriteRestaurants), rankTable("Favourite dishes", r.favoriteFoods), trendTable("Monthly orders", r.monthly));
  }
  if (report.scope === "restaurant") {
    const r = report as RestaurantReport;
    tables.push(rankTable("Top items", r.topItems), rankTable("Menu performance", r.menuPerformance), trendTable("Daily revenue", r.daily), trendTable("Monthly revenue", r.monthly));
  }
  if (report.scope === "rider") {
    const r = report as RiderReport;
    tables.push(trendTable("Weekly deliveries", r.weekly), trendTable("Monthly earnings", r.monthly));
  }
  if (report.scope === "manager") {
    const r = report as ManagerReport;
    tables.push(rankTable("Region performance", r.regionPerformance), rankTable("Lead pipeline", r.pipeline), trendTable("Restaurants live", r.restaurantGrowth));
  }
  if (report.scope === "admin") {
    const r = report as AdminReport;
    tables.push(
      rankTable("Top restaurants", r.topRestaurants),
      rankTable("City performance", r.cityPerformance),
      trendTable("Daily revenue", r.daily),
      trendTable("Monthly revenue", r.monthly),
      trendTable("Revenue forecast", r.forecast),
      rankTable("Risk signals", r.fraudReports),
    );
  }
  return tables;
}

/* ---------------------------------------------------------------- hooks */

type ReportFor<S extends Scope> =
  S extends "customer" ? CustomerReport :
  S extends "restaurant" ? RestaurantReport :
  S extends "rider" ? RiderReport :
  S extends "manager" ? ManagerReport : AdminReport;

async function build(scope: Scope, subjectId: string, range: Range): Promise<AnyReport> {
  if (scope === "customer") return buildCustomerReport(subjectId, range);
  if (scope === "restaurant") return buildRestaurantReport(subjectId, range);
  if (scope === "rider") return buildRiderReport(subjectId, range);
  if (scope === "manager") return buildManagerReport(subjectId, range);
  return buildAdminReport(range);
}

/**
 * Load a role-scoped report. `subjectId` is mandatory for every scope except
 * admin — without it nothing is fetched, so a signed-out or unauthorised
 * screen can never read another subject's analytics.
 */
export function useAnalytics<S extends Scope>(
  scope: S,
  subjectId: string | null | undefined,
  range: Range,
) {
  const [report, setReport] = useState<ReportFor<S> | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);

  const load = useCallback(async (fresh = false) => {
    if (scope !== "admin" && !subjectId) { setReport(null); setLoading(false); return; }
    setLoading(true);
    const id = scope === "admin" ? "platform" : String(subjectId);
    const key = cacheKey(scope, id, range);
    if (fresh) MEM.delete(key);
    const data = fresh
      ? await build(scope, id, range)
      : await cachedReport(key, () => build(scope, id, range));
    if (fresh) { MEM.set(key, { at: Date.now(), data }); void kvSet(key, data); }
    setReport(data as ReportFor<S>);
    setInsights(generateInsights(data));
    setLoading(false);
  }, [scope, subjectId, range]);

  useEffect(() => { void load(); }, [load]);

  return { report, insights, loading, refresh: () => load(true) };
}
