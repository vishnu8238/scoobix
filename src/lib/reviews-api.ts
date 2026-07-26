/**
 * Reviews API — restaurant and driver reviews on the shared `reviews` table.
 *
 * Columns: id, customer_id, restaurant_id, order_id, rating, comment,
 * created_at.
 *
 * A driver review has `restaurant_id = null` and carries the driver reference
 * through its `order_id` (orders.driver_id). That keeps one table for both
 * subjects without inventing schema the backend does not have.
 */
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { nudgeTable } from "./realtime";

export type ReviewRow = {
  id: string;
  customer_id?: string | null;
  restaurant_id?: string | null;
  order_id?: string | null;
  rating?: number | null;
  comment?: string | null;
  created_at?: string;
};

export type RatingSummary = {
  average: number;
  count: number;
  /** breakdown[5] … breakdown[1] */
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
};

export function summarise(rows: ReviewRow[]): RatingSummary {
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const v = Math.round(Number(r.rating ?? 0));
    if (v < 1 || v > 5) continue;
    breakdown[v as 1 | 2 | 3 | 4 | 5] += 1;
    sum += v;
    n += 1;
  }
  return { average: n ? Math.round((sum / n) * 10) / 10 : 0, count: n, breakdown };
}

export function listRestaurantReviews(restaurantId: string) {
  return listTable<ReviewRow>("reviews", {
    restaurant_id: `eq.${restaurantId}`,
    order: "-created_at",
    limit: 200,
  });
}

export async function listDriverReviews(driverId: string): Promise<ReviewRow[]> {
  const orders = await listTable<{ id: string }>("orders", { driver_id: `eq.${driverId}`, limit: 500 });
  const ids = orders.map((o) => o.id).filter(Boolean);
  if (!ids.length) return [];
  const rows = await listTable<ReviewRow>("reviews", { restaurant_id: "is.null", limit: 500 });
  return rows.filter((r) => r.order_id && ids.includes(r.order_id));
}

export function listCustomerReviews(customerId: string) {
  return listTable<ReviewRow>("reviews", {
    customer_id: `eq.${customerId}`,
    order: "-created_at",
    limit: 200,
  });
}

export async function submitReview(input: {
  customerId: string;
  orderId: string;
  rating: number;
  comment?: string;
  /** omit for a driver review */
  restaurantId?: string | null;
}): Promise<ReviewRow | null> {
  const existing = await listTable<ReviewRow>("reviews", {
    order_id: `eq.${input.orderId}`,
    limit: 20,
  });
  const match = existing.find((r) =>
    input.restaurantId ? r.restaurant_id === input.restaurantId : !r.restaurant_id,
  );
  const payload = {
    customer_id: input.customerId,
    order_id: input.orderId,
    restaurant_id: input.restaurantId ?? null,
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    comment: input.comment ?? null,
  };
  const row = match?.id
    ? await patchRecord<ReviewRow>("reviews", match.id, payload)
    : await createRecord<ReviewRow>("reviews", payload);
  nudgeTable("reviews");
  if (input.restaurantId) void refreshRestaurantRating(input.restaurantId);
  else void refreshDriverRating(input.orderId);
  return row;
}

export async function removeReview(id: string) {
  await deleteRecord("reviews", id);
  nudgeTable("reviews");
}

/** Recompute and persist the denormalised rating on `restaurants`. */
export async function refreshRestaurantRating(restaurantId: string) {
  const rows = await listRestaurantReviews(restaurantId);
  const { average } = summarise(rows);
  if (!rows.length) return;
  await patchRecord("restaurants", restaurantId, { rating: average });
  nudgeTable("restaurants");
}

/** Recompute and persist the denormalised rating on `drivers`. */
export async function refreshDriverRating(orderId: string) {
  const orders = await listTable<{ id: string; driver_id?: string | null }>("orders", {
    id: `eq.${orderId}`,
    limit: 1,
  });
  const driverId = orders[0]?.driver_id;
  if (!driverId) return;
  const rows = await listDriverReviews(driverId);
  const { average } = summarise(rows);
  if (!rows.length) return;
  await patchRecord("drivers", driverId, { rating: average });
  nudgeTable("drivers");
}
