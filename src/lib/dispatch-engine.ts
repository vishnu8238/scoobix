/**
 * Driver dispatch engine.
 *
 * Runs as a singleton on any client that mounts useDispatchDaemon().
 */
import { useEffect } from "react";
import { subscribeTable, nudgeTable } from "./realtime";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const OFFER_TIMEOUT_MS = 60_000;
const LEASE_KEY = "scoobix_dispatch_lease";
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

type Row = Record<string, unknown>;
type Offer = { orderId: string; driverId: string; startedAt: number; tried: Set<string> };
const offers = new Map<string, Offer>();

let ordersSnap: Row[] = [];
let driversSnap: Row[] = [];
let restaurantsSnap: Row[] = [];
let trackingSnap: Row[] = [];
let started = false;

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function latestTrackingFor(driverId: string) {
  for (let i = trackingSnap.length - 1; i >= 0; i--) {
    const r = trackingSnap[i];
    if (String(r.driver_id) === driverId) {
      const lat = toNum(r.lat);
      const lng = toNum(r.lng);
      if (lat !== null && lng !== null) return { lat, lng };
    }
  }
  return null;
}

function rankDriversForOrder(order: Row, exclude: Set<string>): string[] {
  const restaurantId = String(order.restaurant_id ?? "");
  const rest = restaurantsSnap.find((r) => String(r.id) === restaurantId);
  const rLat = rest ? toNum(rest.latitude) : null;
  const rLng = rest ? toNum(rest.longitude) : null;
  const restCoords = rLat !== null && rLng !== null ? { lat: rLat, lng: rLng } : null;

  const zoneId = order.zone_id ? String(order.zone_id) : (rest?.zone_id ? String(rest.zone_id) : null);
  const subzoneId = order.subzone_id ? String(order.subzone_id) : (rest?.subzone_id ? String(rest.subzone_id) : null);

  const eligible = driversSnap.filter((d) => {
    const id = String(d.id ?? "");
    if (!id || exclude.has(id)) return false;
    
    const isOnline = d.online_status === true || d.online_status === "true" || d.online_status === "online" || d.online_status === 1;
    if (!isOnline) return false;
    if (d.account_active === false) return false;
    if (d.kyc_approved === false) return false;
    if (d.current_order_id) return false;

    if (zoneId && d.zone_id && String(d.zone_id) !== zoneId) return false;
    return true;
  });

  const scored = eligible.map((d) => {
    const id = String(d.id);
    const loc = latestTrackingFor(id);
    const km = restCoords && loc ? haversineKm(restCoords, loc) : Number.POSITIVE_INFINITY;
    
    let score = km;
    if (subzoneId && d.subzone_id && String(d.subzone_id) === subzoneId) {
      score -= 10;
    }
    
    return { id, score, km };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.id);
}

async function patchOrder(id: string, patch: Row) {
  try {
    await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    nudgeTable("orders");
  } catch { /* best-effort */ }
}

async function offerToNext(order: Row) {
  const orderId = String(order.id);
  const state = offers.get(orderId) ?? { orderId, driverId: "", startedAt: 0, tried: new Set<string>() };
  const queue = rankDriversForOrder(order, state.tried);
  const next = queue[0];
  if (!next) {
    offers.delete(orderId);
    await patchOrder(orderId, { status: "NO_DRIVERS", assignment_status: "NONE", driver_id: null });
    return;
  }
  state.driverId = next;
  state.startedAt = Date.now();
  state.tried.add(next);
  offers.set(orderId, state);
  await patchOrder(orderId, { status: "ASSIGNING", assignment_status: "OFFERED", driver_id: next });
}

function evaluate() {
  if (!acquireLease() && !window.localStorage.getItem("scoobix_test_bypass")) return;
  const now = Date.now();
  for (const order of ordersSnap) {
    const status = String(order.status ?? "");
    const orderId = String(order.id ?? "");
    if (!orderId) continue;

    if (status === "ACCEPTED" && !order.driver_id) {
      if (!offers.has(orderId)) void offerToNext(order);
    } else if (status === "ASSIGNING") {
      const state = offers.get(orderId);
      if (!state) {
        offers.set(orderId, {
          orderId,
          driverId: String(order.driver_id ?? ""),
          startedAt: now,
          tried: new Set<string>([String(order.driver_id ?? "")]),
        });
        continue;
      }
      if (now - state.startedAt > OFFER_TIMEOUT_MS) {
        void offerToNext(order);
      }
    } else if (status === "PICKED_UP" || status === "ON_THE_WAY" || status === "DELIVERED" || status === "CANCELLED" || status === "REJECTED") {
      offers.delete(orderId);
    }
  }
}

function ensureStreams() {
  if (started) return;
  started = true;
  subscribeTable("orders", { params: { limit: 500, order: "-created_at" }, minMs: 1500, maxMs: 8000 }, (rs) => {
    ordersSnap = rs;
    evaluate();
  });
  subscribeTable("drivers", { params: { limit: 500 }, minMs: 4000, maxMs: 20000 }, (rs) => {
    driversSnap = rs;
  });
  subscribeTable("restaurants", { params: { limit: 500 }, minMs: 15000, maxMs: 60000 }, (rs) => {
    restaurantsSnap = rs;
  });
  subscribeTable("driver_tracking", { params: { limit: 1000 }, minMs: 3000, maxMs: 20000 }, (rs) => {
    trackingSnap = rs;
  });
  if (typeof window !== "undefined") {
    window.setInterval(evaluate, 2000);
  }
}

export function markOfferAccepted(orderId: string) {
  offers.delete(orderId);
}

export async function markOfferRejected(orderId: string) {
  const state = offers.get(orderId);
  if (state) {
    state.startedAt = 0;
    offers.set(orderId, state);
  }
  await patchOrder(orderId, { status: "ACCEPTED", assignment_status: "SEARCHING", driver_id: null });
}

export function useDispatchDaemon() {
  useEffect(() => { ensureStreams(); }, []);
}

export function offerRemainingMs(orderId: string): number | null {
  const s = offers.get(orderId);
  if (!s) return null;
  return Math.max(0, OFFER_TIMEOUT_MS - (Date.now() - s.startedAt));
}

export const OFFER_TIMEOUT_SEC = OFFER_TIMEOUT_MS / 1000;
