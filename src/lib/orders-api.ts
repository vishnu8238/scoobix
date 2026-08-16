/**
 * Server-authoritative order API (InsForge).
 *
 * The `orders` table is the single source of truth for every order in the
 * platform — customer history, partner dashboard, rider jobs and admin.
 * No localStorage anywhere in this module.
 *
 * Schema notes (verified against the live project):
 *   orders.id            uuid, NO default → must be generated client-side
 *   orders.items         jsonb NOT NULL   → full line snapshot + meta
 *   order_items          uuid id, menu_item_id uuid|null, quantity, price, addons
 *   payments             uuid id, order_id, amount, method, status
 *   Updates/deletes MUST use `?id=eq.<uuid>` (path-style routes 404).
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";
import type { CartItem, Order, OrderStatus } from "./stores";


const getHeaders = async () => {
  const { getAccessToken } = await import("./insforge");
  const token = await getAccessToken();
  
  // Use authoritative anon key as fallback if session is not yet hydrated
  const finalToken = token || INSFORGE_ANON_KEY;
  
  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: `Bearer ${finalToken}`,
    "Content-Type": "application/json",
  };
};

const rec = (table: string) => `${INSFORGE_URL}/api/database/records/${table}`;

export function newUuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type OrderRow = Record<string, unknown> & { id?: string };

/* ---------------- status mapping ---------------- */

const LOCAL: OrderStatus[] = [
  "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "CANCELLED",
];

export function mapStatus(s: unknown, fallback: OrderStatus = "PLACED"): OrderStatus {
  const v = String(s ?? "").toUpperCase();
  if ((LOCAL as string[]).includes(v)) return v as OrderStatus;
  if (v === "ASSIGNING" || v === "NO_DRIVERS") return "READY";
  if (v === "ARRIVED" || v === "TO_DROP" || v === "TO_PICKUP" || v === "AT_PICKUP") return "ON_THE_WAY";
  if (v === "REJECTED") return "CANCELLED";
  if (v === "COMPLETED") return "DELIVERED";
  return fallback;
}

/* ---------------- row <-> Order ---------------- */

type Meta = {
  restaurantName?: string;
  restaurantImage?: string;
  addressLabel?: string;
  addressLine?: string;
  paymentLabel?: string;
  deliveryInstructions?: string;
  contactless?: boolean;
  notes?: string;
  couponCode?: string;
  etaMins?: number;
};

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}

function readItems(raw: unknown): { lines: CartItem[]; meta: Meta } {
  if (Array.isArray(raw)) return { lines: raw as CartItem[], meta: {} };
  if (raw && typeof raw === "object") {
    const o = raw as { lines?: unknown; meta?: unknown };
    return {
      lines: Array.isArray(o.lines) ? (o.lines as CartItem[]) : [],
      meta: (o.meta && typeof o.meta === "object" ? (o.meta as Meta) : {}),
    };
  }
  if (typeof raw === "string") {
    try { return readItems(JSON.parse(raw)); } catch { /* ignore */ }
  }
  return { lines: [], meta: {} };
}

export function rowToOrder(row: OrderRow): Order {
  const { lines, meta } = readItems(row.items);
  const id = String(row.id ?? "");
  return {
    id,
    restaurantId: String(row.restaurant_id ?? ""),
    restaurantName: meta.restaurantName || "Restaurant",
    restaurantImage: meta.restaurantImage || "",
    items: lines,
    total: num(row.total_price),
    subtotal: num(row.subtotal),
    delivery: num(row.delivery_fee),
    taxes: num(row.taxes ?? row.tax),
    discount: num(row.discount),
    status: mapStatus(row.status),
    placedAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
    addressLabel: meta.addressLabel || "Delivery",
    addressLine: meta.addressLine || String(row.delivery_address ?? ""),
    paymentLabel: meta.paymentLabel || String(row.payment_method ?? "—"),
    driver: { name: "", vehicle: "", rating: 0, phone: "" },
    etaMins: meta.etaMins ?? 30,
    deliveryInstructions: meta.deliveryInstructions,
    contactless: meta.contactless,
    notes: meta.notes,
    couponCode: meta.couponCode,
    driverId: row.driver_id ? String(row.driver_id) : undefined,
    otp: row.otp ? String(row.otp) : undefined,
    paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
    pickup_latitude: row.pickup_latitude ? num(row.pickup_latitude) : undefined,
    pickup_longitude: row.pickup_longitude ? num(row.pickup_longitude) : undefined,
    pickup_address: row.pickup_address ? String(row.pickup_address) : undefined,
  };
}

/* ---------------- reads ---------------- */

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const headers = await getHeaders();
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 401) console.error("[ORDERS_API] Unauthorized request to", url);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[ORDERS_API] Fetch error:", e);
    return null;
  }
}

export async function fetchCustomerOrders(customerId: string): Promise<Order[]> {
  if (!isUuid(customerId)) return [];
  const rows = await getJson<OrderRow[]>(
    `${rec("orders")}?customer_id=eq.${customerId}&order=created_at.desc&limit=100`,
  );
  return Array.isArray(rows) ? rows.map(rowToOrder) : [];
}

export async function fetchOrderRow(orderId: string): Promise<OrderRow | null> {
  if (!isUuid(orderId)) return null;
  const rows = await getJson<OrderRow[]>(`${rec("orders")}?id=eq.${orderId}&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function fetchOrder(orderId: string): Promise<Order | null> {
  const row = await fetchOrderRow(orderId);
  return row ? rowToOrder(row) : null;
}

/* ---------------- writes ---------------- */

export type PlaceOrderInput = {
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  items: CartItem[];
  totals: { subtotal: number; delivery: number; taxes: number; discount: number; total: number };
  addressLabel: string;
  addressLine: string;
  paymentMethod: string;
  paymentLabel: string;
  deliveryInstructions?: string;
  contactless?: boolean;
  notes?: string;
  couponCode?: string;
  etaMins?: number;
  // Zone context
  zoneId?: string;
  subzoneId?: string;
};

/**
 * Creates orders → order_items → payments(PENDING). Returns the persisted
 * order or null when the backend rejected the write.
 */
export async function createOrder(input: PlaceOrderInput): Promise<Order | null> {
  if (!isUuid(input.customerId) || !isUuid(input.restaurantId)) return null;
  const id = newUuid();
  const otp = String(Math.floor(1000 + Math.random() * 9000));

  // If zoneId/subzoneId weren't passed (customer app might not have them yet),
  // we attempt to resolve them from the restaurant row.
  let zoneId = input.zoneId;
  let subzoneId = input.subzoneId;

  let pickupLat: number | null = null;
  let pickupLng: number | null = null;
  let pickupAddr: string | null = null;

  try {
    const headers = await getHeaders();
    const res = await fetch(`${rec("restaurants")}?id=eq.${input.restaurantId}&select=latitude,longitude,address`, { headers });
    const data = await res.json();
    if (data?.[0]) {
      // zone_id and subzone_id removed from restaurants schema
      if (!zoneId) zoneId = null;
      if (!subzoneId) subzoneId = null;
      pickupLat = data[0].latitude;
      pickupLng = data[0].longitude;
      pickupAddr = data[0].address;
    }
  } catch (e) {
    console.error("[ORDERS_API] Failed to resolve restaurant context for order", e);
  }

  const meta: Meta = {
    restaurantName: input.restaurantName,
    restaurantImage: input.restaurantImage,
    addressLabel: input.addressLabel,
    addressLine: input.addressLine,
    paymentLabel: input.paymentLabel,
    deliveryInstructions: input.deliveryInstructions,
    contactless: input.contactless,
    notes: input.notes,
    couponCode: input.couponCode,
    etaMins: input.etaMins,
  };

  const body = {
    id,
    customer_id: input.customerId,
    restaurant_id: input.restaurantId,
    zone_id: zoneId,
    subzone_id: subzoneId,
    items: { lines: input.items, meta },
    status: "PLACED",
    subtotal: input.totals.subtotal,
    delivery_fee: input.totals.delivery,
    taxes: input.totals.taxes,
    discount: input.totals.discount,
    total_price: input.totals.total,
    delivery_address: `${input.addressLabel} · ${input.addressLine}`,
    pickup_latitude: pickupLat,
    pickup_longitude: pickupLng,
    pickup_address: pickupAddr,
    payment_method: input.paymentMethod,
    payment_status: "PENDING",
    assignment_status: "SEARCHING",
    otp,
  };

  try {
    const headers = await getHeaders();
    const res = await fetch(rec("orders"), { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
  } catch {
    return null;
  }

  const childHeaders = await getHeaders();
  await Promise.all([
    ...input.items.map((it) =>
      fetch(rec("order_items"), {
        method: "POST",
        headers: childHeaders,
        body: JSON.stringify({
          id: newUuid(),
          order_id: id,
          menu_item_id: isUuid(it.dishId) ? it.dishId : null,
          quantity: it.qty,
          price: it.price,
          addons: it.customizations ?? [],
        }),
      }).catch(() => null),
    ),
    fetch(rec("payments"), {
      method: "POST",
      headers: childHeaders,
      body: JSON.stringify({
        id: newUuid(),
        order_id: id,
        amount: input.totals.total,
        method: input.paymentMethod,
        status: "PENDING",
      }),
    }).catch(() => null),
  ]);

  publishTableChange("orders", "insert", body as Record<string, unknown>);

  return rowToOrder({ ...body, created_at: new Date().toISOString() });
}

/** Patch an order row (query-param form — the only one this API supports). */
export async function patchOrder(orderId: string, patch: Record<string, unknown>): Promise<boolean> {
  if (!isUuid(orderId)) return false;
  try {
    const headers = await getHeaders();
    const res = await fetch(`${rec("orders")}?id=eq.${orderId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    if (res.ok) publishTableChange("orders", "update", { id: orderId, ...patch });
    return res.ok;
  } catch {
    return false;
  }
}

export type { OrderStatus };
// OrderStatus is now managed in stores.tsx to prevent duplication conflicts.

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["ASSIGNING", "CANCELLED"],
  ASSIGNING: ["ASSIGNED", "READY", "CANCELLED"],
  ASSIGNED: ["AT_PICKUP", "ASSIGNING", "CANCELLED"],
  AT_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

export { STATUS_LABEL } from "./stores";

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) || false;
}


/** Mark the payment row for an order (used when payment status changes). */
export async function patchPaymentByOrder(orderId: string, patch: Record<string, unknown>): Promise<void> {
  if (!isUuid(orderId)) return;
  try {
    const headers = await getHeaders();
    await fetch(`${rec("payments")}?order_id=eq.${orderId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    publishTableChange("payments", "update", { order_id: orderId, ...patch });
  } catch { /* ignore */ }
}
