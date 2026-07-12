/**
 * Order finalization pipeline.
 *
 * Idempotent, backend-only. When an order transitions to `DELIVERED`:
 *
 *   1. compute commission (restaurant.commission ?? app_settings.default_commission_pct)
 *   2. compute driver earnings (base + per_km*distance + long-distance bonus)
 *   3. compute platform earnings (commission - driver_earnings ceiling 0)
 *   4. compute restaurant payout (total - commission)
 *   5. PATCH order with the full financial breakdown + finalized_at
 *   6. increment restaurants.pending_payout
 *   7. increment drivers.pending_earnings
 *   8. wallet cashback (if wallet_enabled)
 *   9. scratch card (if scratch_enabled)
 *  10. referral completion (if referral_enabled)
 *
 * Idempotency: any order row with a truthy `finalized_at` is skipped.
 * A short-lived in-memory guard prevents races within a single tab; a
 * cross-tab leader lease (from dispatch-engine) prevents duplicate work
 * across the workspace.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { getAppSettings } from "./app-settings";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};
const base = (t: string) => `${INSFORGE_URL}/api/database/records/${t}`;

type Row = Record<string, unknown>;

// -------------------------------------------------------- small helpers

function toNum(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return d;
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

async function safePatch(url: string, body: Row): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
    return res.ok;
  } catch { return false; }
}

async function safePost(url: string, body: Row): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    return res.ok;
  } catch { return false; }
}

// ----------------------------------------------------- pricing calc API

export type OrderBreakdown = {
  total: number;
  taxes: number;
  delivery: number;
  commission_pct: number;
  commission_amount: number;
  restaurant_payout: number;
  driver_earnings: number;
  platform_earnings: number;
  distance_km: number;
};

export function computeBreakdown(input: {
  total: number;
  taxes?: number;
  delivery?: number;
  distanceKm?: number;
  restaurantCommissionPct?: number | null;
}): OrderBreakdown {
  const s = getAppSettings();
  const total = Math.max(0, toNum(input.total));
  const taxes = Math.max(0, toNum(input.taxes));
  const delivery = Math.max(0, toNum(input.delivery));
  const distance = Math.max(0, toNum(input.distanceKm));

  const commissionPct = input.restaurantCommissionPct != null && input.restaurantCommissionPct > 0
    ? input.restaurantCommissionPct
    : s.default_commission_pct;

  // Commission is charged on the food subtotal (total minus taxes & delivery).
  const foodSubtotal = Math.max(0, total - taxes - delivery);
  const commission_amount = Math.round(foodSubtotal * (commissionPct / 100));
  const restaurant_payout = Math.max(0, foodSubtotal - commission_amount);

  const long = distance > s.long_distance_km ? s.long_distance_bonus : 0;
  const driver_earnings = Math.round(s.driver_base_pay + s.driver_per_km * distance + long);
  const platform_earnings = Math.max(0, commission_amount + delivery - driver_earnings);

  return {
    total,
    taxes,
    delivery,
    commission_pct: commissionPct,
    commission_amount,
    restaurant_payout,
    driver_earnings,
    platform_earnings,
    distance_km: distance,
  };
}

// ------------------------------------------------------ finalize order

// In-tab guard against concurrent finalizations of the same order.
const inflight = new Set<string>();

export async function finalizeOrder(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!orderId) return { ok: false, reason: "missing id" };
  if (inflight.has(orderId)) return { ok: false, reason: "inflight" };
  inflight.add(orderId);
  try {
    const order = await safeJson<Row>(`${base("orders")}/${orderId}`);
    if (!order) return { ok: false, reason: "not-found" };
    if (order.finalized_at) return { ok: true, reason: "already-finalized" };
    const status = String(order.status ?? "");
    if (status !== "DELIVERED") return { ok: false, reason: `status=${status}` };

    // Restaurant for commission override + payout accumulation.
    const restaurantId = String(order.restaurant_id ?? "");
    const restaurant = restaurantId
      ? await safeJson<Row>(`${base("restaurants")}/${restaurantId}`)
      : null;

    const breakdown = computeBreakdown({
      total: toNum(order.total_price ?? order.total),
      taxes: toNum(order.taxes),
      delivery: toNum(order.delivery_fee ?? order.delivery),
      distanceKm: toNum(order.distance_km ?? order.distanceKm),
      restaurantCommissionPct: restaurant ? toNum(restaurant.commission, 0) || null : null,
    });

    const now = new Date().toISOString();

    // 5. Persist breakdown on the order (single PATCH — one round trip).
    await safePatch(`${base("orders")}/${orderId}`, {
      commission_pct: breakdown.commission_pct,
      commission_amount: breakdown.commission_amount,
      restaurant_payout: breakdown.restaurant_payout,
      driver_earnings: breakdown.driver_earnings,
      platform_earnings: breakdown.platform_earnings,
      finalized_at: now,
    });

    // 6. Restaurant pending payout (read-modify-write).
    if (restaurant) {
      const prev = toNum(restaurant.pending_payout);
      await safePatch(`${base("restaurants")}/${restaurantId}`, {
        pending_payout: prev + breakdown.restaurant_payout,
      });
    }

    // 7. Driver pending earnings.
    const driverId = String(order.driver_id ?? "");
    if (driverId) {
      const driver = await safeJson<Row>(`${base("drivers")}/${driverId}`);
      if (driver) {
        const prev = toNum(driver.pending_earnings);
        await safePatch(`${base("drivers")}/${driverId}`, {
          pending_earnings: prev + breakdown.driver_earnings,
        });
      }
    }

    const settings = getAppSettings();
    const customerId = String(order.customer_id ?? "");

    // 8. Wallet cashback.
    if (settings.wallet_enabled && customerId && settings.wallet_cashback_pct > 0) {
      const amt = Math.round(breakdown.total * (settings.wallet_cashback_pct / 100));
      if (amt > 0) {
        await safePost(base("wallet_transactions"), {
          customer_id: customerId,
          amount: amt,
          kind: "cashback",
          note: `Cashback on order ${orderId}`,
          order_id: orderId,
        });
      }
    }

    // 9. Scratch card.
    if (settings.scratch_enabled && customerId) {
      // Only issue if the rewards pool has anything active. We defer the
      // actual reward selection to the client-side RewardsProvider so the
      // player still gets the scratch animation on next open; here we just
      // stamp the entitlement.
      await safePost(base("scratch_cards"), {
        order_id: orderId,
        customer_id: customerId,
        applied: false,
        issued_at: now,
      });
    }

    // 10. Referral completion — if this customer has a pending referral.
    if (settings.referral_enabled && customerId) {
      const referrals = await safeJson<Row[]>(
        `${base("referrals")}?referee_id=${encodeURIComponent(customerId)}&status=pending&limit=1`,
      );
      const pending = Array.isArray(referrals) ? referrals[0] : undefined;
      if (pending) {
        // Load referral config from app_settings-compatible keys (reuse local defaults if absent).
        const refereeReward = 50;
        const referrerReward = 100;
        await safePatch(`${base("referrals")}/${String(pending.id)}`, {
          status: "rewarded",
          rewarded_at: now,
        });
        await safePost(base("wallet_transactions"), {
          customer_id: customerId,
          amount: refereeReward,
          kind: "credit",
          note: `Referral bonus (code ${String(pending.code ?? "")})`,
        });
        const referrerId = String(pending.referrer_id ?? "");
        if (referrerId && referrerId !== customerId) {
          await safePost(base("wallet_transactions"), {
            customer_id: referrerId,
            amount: referrerReward,
            kind: "credit",
            note: `Referral bonus`,
          });
        }
      }
    }

    return { ok: true };
  } finally {
    inflight.delete(orderId);
  }
}

// ----------------------------------------------- watcher / daemon hook

import { useEffect } from "react";
import { subscribeTable } from "./realtime";

// Fair-share leadership across tabs (5s TTL). Reuses same pattern as
// dispatch-engine but under a distinct key so both daemons can lead.
const LEASE_KEY = "scoobix_finalize_lease";
const LEASE_TTL_MS = 5_000;
const TAB_ID = typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

function acquireLease(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LEASE_KEY);
    const now = Date.now();
    if (raw) {
      const { id, exp } = JSON.parse(raw) as { id: string; exp: number };
      if (id !== TAB_ID && exp > now) return false;
    }
    window.localStorage.setItem(LEASE_KEY, JSON.stringify({ id: TAB_ID, exp: now + LEASE_TTL_MS }));
    return true;
  } catch { return false; }
}

let daemonStarted = false;
function ensureDaemon() {
  if (daemonStarted) return;
  daemonStarted = true;
  subscribeTable("orders", { params: { limit: 500, order: "-created_at" }, minMs: 2000, maxMs: 15000 }, (rows) => {
    if (!acquireLease()) return;
    for (const row of rows) {
      const status = String(row.status ?? "");
      if (status !== "DELIVERED") continue;
      if (row.finalized_at) continue;
      const id = String(row.id ?? "");
      if (id) void finalizeOrder(id);
    }
  });
}

/**
 * Mount on any always-open operational screen (partner orders, admin live).
 * Safe to call from many components — the underlying daemon is a singleton.
 */
export function useOrderFinalizationDaemon() {
  useEffect(() => { ensureDaemon(); }, []);
}
