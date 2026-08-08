/**
 * InsForge data layer for Scoobix.
 *
 * Publishable values (project URL + anon key) are embedded here — they are
 * client-readable by design, same as a Supabase anon key. The server-only
 * INSFORGE_API_KEY secret is never imported in the client bundle.
 *
 * Strategy: fetch InsForge rows once at app boot, MERGE them into the existing
 * mock-data arrays (`restaurants`, `categories`). All 17 existing consumers
 * continue to work unchanged. On error or empty response the mock data is
 * left in place as a fallback.
 */

import {
  restaurants,
  categories,
  trendingDishIds,
  recommendedDishIds,
  type Restaurant,
  type Dish,
  type Category,
} from "./mock-data";
import { Map as MapIcon } from "lucide-react";



import { getAccessToken } from "./insforge-auth";

export const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_ANON_KEY = "anon_f8c2fce9afe385f45eb6d00d434eb365833a70386175df3707743df3b751b102";

const insforgeHeaders = () => {
  const token = getAccessToken();
  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: `Bearer ${token || INSFORGE_ANON_KEY}`,
  };
};


// ---------- raw row shapes (loose — backend may add/omit fields) ----------

type RestaurantRow = {
  id: string;
  name?: string;
  logo?: string;
  logo_url?: string;
  cover?: string;
  cover_url?: string;
  cover_image?: string;
  rating?: number;
  address?: string;
  is_open?: boolean;
  veg_status?: boolean | string;
};

type CategoryRow = {
  id: string;
  name?: string;
  image_url?: string;
  active?: boolean;
};

type MenuItemRow = {
  id: string;
  restaurant_id?: string;
  name?: string;
  description?: string;
  price?: number;
  image_url?: string;
  veg_type?: "veg" | "non_veg" | "egg" | string;
  available?: boolean;
  recommended?: boolean;
  best_seller?: boolean;
  category?: string;
};

export type AddonRow = {
  id: string;
  dish_id: string;
  name: string;
  price: number;
  available: boolean;
};

// ---------- fetch helper ----------

async function ifFetch<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    ...init,
    headers: {
      ...insforgeHeaders(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },

    signal,
  });
  if (!res.ok) throw new Error(`InsForge ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- writes ----------

// ---------- partner-side writes (best-effort, never throw) ----------

async function ifWrite(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${INSFORGE_URL}${path}`, {
      method,
      headers: {
        ...insforgeHeaders(),
        "Content-Type": "application/json",
      },

      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.ok) {
      // Push the change to every other open client (rider, partner, admin…).
      const table = path.split("/records/")[1]?.split("?")[0];
      if (table) {
        const idMatch = path.match(/id=eq\.([^&]+)/);
        const row = {
          ...(typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {}),
          ...(idMatch ? { id: decodeURIComponent(idMatch[1]) } : {}),
        };
        const op = method === "POST" ? "insert" : method === "PATCH" ? "update" : "delete";
        const { publishTableChange } = await import("./realtime-bus");
        publishTableChange(table, op, row);
      }
    }
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}


/** Update restaurant open / accepting / status flags. */
export function updateRestaurantStatus(
  id: string,
  patch: { is_open?: boolean; accepting_orders?: boolean; status?: string },
) {
  return ifWrite(`/api/database/records/restaurants?id=eq.${id}`, "PATCH", patch);
}

/** Upsert a menu item (insert if new id, patch otherwise). */
export function upsertMenuItem(item: {
  id?: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  veg_type?: "veg" | "non_veg" | "egg";
  available?: boolean;
  recommended?: boolean;
  best_seller?: boolean;
}) {
  if (item.id && !item.id.startsWith("n")) {
    return ifWrite(`/api/database/records/menu_items?id=eq.${item.id}`, "PATCH", item);
  }
  return ifWrite(`/api/database/records/menu_items`, "POST", item);
}

export function deleteMenuItem(id: string) {
  return ifWrite(`/api/database/records/menu_items?id=eq.${id}`, "DELETE");
}

/** Admin: Destructive delete for a restaurant and its tightly coupled sub-records.
 *  Preserves orders, payments, and audit logs.
 */
export async function deleteRestaurantComplete(id: string) {
  // 1. Get all related records that should be cleaned up
  const [menuItems, categories, coupons, kycDocs] = await Promise.all([
    ifFetch<MenuItemRow[]>(`/api/database/records/menu_items?restaurant_id=eq.${id}`),
    ifFetch<CategoryRow[]>(`/api/database/records/categories?restaurant_id=eq.${id}`),
    ifFetch<any[]>(`/api/database/records/coupons?restaurant_id=eq.${id}`),
    ifFetch<any[]>(`/api/database/records/restaurant_kyc?restaurant_id=eq.${id}&limit=100`),
  ]).catch(() => [[], [], [], []]);

  // 2. Cleanup Storage (Images)
  const { deleteObject } = await import("./image-service");
  const keysToDelete = new Set<string>();

  // Collect keys from restaurant itself
  const [rest] = await ifFetch<RestaurantRow[]>(`/api/database/records/restaurants?id=eq.${id}&limit=1`).catch(() => []);
  if (rest?.logo_url?.includes("/objects/")) keysToDelete.add(rest.logo_url.split("/objects/")[1]);
  if (rest?.cover_url?.includes("/objects/")) keysToDelete.add(rest.cover_url.split("/objects/")[1]);

  // Collect keys from menu items
  menuItems.forEach(item => {
    if (item.image_url?.includes("/objects/")) keysToDelete.add(item.image_url.split("/objects/")[1]);
  });

  // Collect keys from KYC
  kycDocs.forEach(doc => {
    if (doc.file_url?.includes("/objects/")) keysToDelete.add(doc.file_url.split("/objects/")[1]);
  });

  // Perform storage deletion (best-effort)
  for (const key of keysToDelete) {
    void deleteObject(decodeURIComponent(key)).catch(() => {});
  }

  // 3. Delete DB records in order (respecting possible FKs)
  await Promise.all([
    ifWrite(`/api/database/records/addons?dish_id=in.(${menuItems.map(m => m.id).join(",") || "0"})`, "DELETE"),
    ifWrite(`/api/database/records/menu_items?restaurant_id=eq.${id}`, "DELETE"),
    ifWrite(`/api/database/records/categories?restaurant_id=eq.${id}`, "DELETE"),
    ifWrite(`/api/database/records/coupons?restaurant_id=eq.${id}`, "DELETE"),
    ifWrite(`/api/database/records/restaurant_kyc?restaurant_id=eq.${id}`, "DELETE"),
  ]).catch(() => {});

  // 4. Finally delete the restaurant
  return ifWrite(`/api/database/records/restaurants?id=eq.${id}`, "DELETE");
}

/** Addon CRUD. */
export function upsertAddon(addon: {
  id?: string;
  dish_id: string;
  name: string;
  price: number;
  available?: boolean;
}) {
  if (addon.id && !addon.id.startsWith("a")) {
    return ifWrite(`/api/database/records/addons?id=eq.${addon.id}`, "PATCH", addon);
  }
  return ifWrite(`/api/database/records/addons`, "POST", addon);
}

export function deleteAddon(id: string) {
  return ifWrite(`/api/database/records/addons?id=eq.${id}`, "DELETE");
}

/** Order lifecycle for partner. */
export function updateOrderStatus(
  id: string,
  patch: { status?: string; prep_minutes?: number; reject_reason?: string },
) {
  // Only columns that exist on `orders` are sent; prep time is stored as an ETA.
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (typeof patch.prep_minutes === "number") {
    body.estimated_delivery_time = new Date(Date.now() + patch.prep_minutes * 60_000).toISOString();
  }
  if (patch.status === "DELIVERED") body.actual_delivery_time = new Date().toISOString();
  if (!Object.keys(body).length) return Promise.resolve({ ok: true });
  return ifWrite(`/api/database/records/orders?id=eq.${id}`, "PATCH", body);
}

// ---------- rider-side writes (best-effort, never throw) ----------

/** Toggle driver online/offline. */
export function setDriverOnline(driverId: string, online: boolean) {
  return ifWrite(`/api/database/records/drivers?id=eq.${driverId}`, "PATCH", { online_status: online });
}

/** Accept a delivery request — claim the order for this driver. */
export function acceptDeliveryRequest(orderId: string, driverId: string) {
  return ifWrite(`/api/database/records/orders?id=eq.${orderId}`, "PATCH", {
    driver_id: driverId,
    status: "PICKED_UP",
  });
}

/** Driver-side order status update (READY → PICKED_UP → DELIVERED, etc.). */
export function updateDeliveryStatus(orderId: string, status: string) {
  return ifWrite(`/api/database/records/orders?id=eq.${orderId}`, "PATCH", { status });
}

/** Append a live-location ping for the driver (driver_tracking: lat/lng/bearing). */
export function pingDriverLocation(driverId: string, lat: number, lng: number) {
  return ifWrite(`/api/database/records/driver_tracking`, "POST", {
    driver_id: driverId,
    lat,
    lng,
  });
}


// ---------- admin-side writes (best-effort, never throw) ----------

/** Generic record CRUD — for admin pages with diverse tables. */
export function adminCreate(table: string, record: Record<string, unknown>) {
  return ifWrite(`/api/database/records/${table}`, "POST", record);
}
export function adminPatch(table: string, id: string, patch: Record<string, unknown>) {
  return ifWrite(`/api/database/records/${table}?id=eq.${id}`, "PATCH", patch);
}
export function adminDelete(table: string, id: string) {
  return ifWrite(`/api/database/records/${table}?id=eq.${id}`, "DELETE");
}

/** Admin-set commission %. */
export function setRestaurantCommission(id: string, commission: number) {
  return ifWrite(`/api/database/records/restaurants?id=eq.${id}`, "PATCH", { commission });
}

/** Admin approve/reject/suspend a restaurant. */
export function setRestaurantApprovalStatus(id: string, status: "approved" | "rejected" | "suspended" | "pending") {
  return ifWrite(`/api/database/records/restaurants?id=eq.${id}`, "PATCH", { status });
}

// ---------- Scoobix feature extensions (best-effort, never throw) ----------

export function createMealSubscription(sub: {
  customer_id: string;
  restaurant_id: string;
  plan: "weekly" | "monthly";
  meals: "lunch" | "dinner" | "both";
  starts_on: string;
  address?: string;
  price?: number;
}) { return ifWrite(`/api/database/records/meal_subscriptions`, "POST", sub); }

export function updateMealSubscription(id: string, patch: Record<string, unknown>) {
  return ifWrite(`/api/database/records/meal_subscriptions?id=eq.${id}`, "PATCH", patch);
}

export function listMealSubscriptions(params?: { customer_id?: string; restaurant_id?: string }) {
  const q = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return ifFetch<Record<string, unknown>[]>(`/api/database/records/meal_subscriptions${q}`).catch(() => [] as Record<string, unknown>[]);
}

export function createBulkRequest(req: {
  customer_id: string;
  restaurant_id?: string;
  event_date: string;
  guest_count: number;
  budget: number;
  notes?: string;
}) { return ifWrite(`/api/database/records/bulk_requests`, "POST", { status: "pending", ...req }); }

export function listBulkRequests(params?: { customer_id?: string; restaurant_id?: string }) {
  const q = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return ifFetch<Record<string, unknown>[]>(`/api/database/records/bulk_requests${q}`).catch(() => [] as Record<string, unknown>[]);
}

export function updateBulkStatus(id: string, status: "pending" | "accepted" | "rejected") {
  return ifWrite(`/api/database/records/bulk_requests?id=eq.${id}`, "PATCH", { status });
}

export function createGroupCart(session: { id: string; host_id: string; restaurant_id: string }) {
  return ifWrite(`/api/database/records/group_carts`, "POST", session);
}
export function getGroupCartRow(id: string) {
  return ifFetch<Record<string, unknown>[]>(`/api/database/records/group_carts?id=eq.${id}&limit=1`).then((r) => (Array.isArray(r) ? r[0] ?? null : null)).catch(() => null);
}
export function updateGroupCart(id: string, patch: Record<string, unknown>) {
  return ifWrite(`/api/database/records/group_carts?id=eq.${id}`, "PATCH", patch);
}

/**
 * Spotlight has no dedicated table — it is stored as a JSON row in
 * `app_settings` (key = 'spotlight') through the shared kv helpers.
 */
export async function getSpotlightRow(): Promise<Record<string, unknown>[]> {
  const { kvGet } = await import("./kv-store");
  const v = await kvGet<Record<string, unknown>>("spotlight");
  return v ? [v] : [];
}
export async function setSpotlight(record: Record<string, unknown>) {
  const { kvSet } = await import("./kv-store");
  await kvSet("spotlight", record);
  return null;
}


/** Scheduling / batching have no backing columns yet — kept as no-ops so
 *  callers stay stable once the schema gains them. */
export function scheduleOrder(_orderId: string, _iso: string) {
  return Promise.resolve({ ok: true });
}
export function assignBatch(_orderId: string, _batchId: string) {
  return Promise.resolve({ ok: true });
}









// ---------- row → mock-shape adapters ----------

function toRestaurant(row: RestaurantRow, menu: Dish[]): Restaurant {
  const logo = row.logo_url || row.logo || "";
  const cover = row.cover_url || row.cover_image || row.cover || "";
  return {
    id: row.id,
    name: row.name ?? "Untitled",
    cuisine: row.address ?? "",
    rating: typeof row.rating === "number" ? row.rating : 4.5,
    reviews: 100,
    deliveryMins: 30,
    distanceKm: 2,
    priceLevel: "₹₹",
    cover,
    logo,
    tags: [],
    menu,
  };
}

function toDish(row: MenuItemRow): Dish {
  const cat = (row.category as Dish["category"]) ?? "Main Course";
  return {
    id: row.id,
    name: row.name ?? "Untitled",
    description: row.description ?? "",
    price: typeof row.price === "number" ? row.price : 0,
    image: row.image_url || "",
    rating: 4.5,
    category: ["Starters", "Main Course", "Drinks", "Desserts"].includes(cat) ? cat : "Main Course",
    cuisineTag: "",
    veg: row.veg_type === "veg",
    popular: !!row.recommended || !!row.best_seller,
  };
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name ?? "Untitled",
    emoji: "🍽️",
    image: row.image_url || "",
  };
}

// ---------- one-shot bootstrap ----------

let bootstrapPromise: Promise<{ ok: boolean; error?: string }> | null = null;
const BOOTSTRAP_BATCH_SIZE = 500;

async function fetchAll<T>(path: string, limit = 2000): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const signal = new AbortController().signal;

  while (offset < limit) {
    const batchLimit = Math.min(BOOTSTRAP_BATCH_SIZE, limit - offset);
    const qs = path.includes("?") ? `&limit=${batchLimit}&offset=${offset}` : `?limit=${batchLimit}&offset=${offset}`;
    const batch = await ifFetch<T[]>(`${path}${qs}`, signal).catch(() => [] as T[]);
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < batchLimit) break;
    offset += batchLimit;
  }
  return all;
}

export type InsForgeStatus = "idle" | "loading" | "ready" | "error" | "empty";

/**
 * Catalog version — bumped once live restaurants/categories replace the seed
 * arrays, so screens that read those arrays synchronously can re-render.
 */
let catalogVersion = 0;
const catalogListeners = new Set<() => void>();
function bumpCatalog() {
  catalogVersion += 1;
  catalogListeners.forEach((fn) => fn());
}
export function subscribeCatalog(fn: () => void): () => void {
  catalogListeners.add(fn);
  return () => catalogListeners.delete(fn);
}
export function getCatalogVersion(): number {
  return catalogVersion;
}

export const insforgeState: {

  status: InsForgeStatus;
  error?: string;
  addonsByDish: Map<string, AddonRow[]>;
} = {
  status: "idle",
  addonsByDish: new Map(),
};

/**
 * Fetch restaurants + categories + menu_items + addons in parallel and merge
 * them into the existing mock arrays. Safe to call multiple times — only
 * runs once. Returns `{ ok }` so callers can show a retry UI.
 */
export function bootstrapInsForge(): Promise<{ ok: boolean; error?: string }> {
  if (bootstrapPromise) return bootstrapPromise;
  insforgeState.status = "loading";

  bootstrapPromise = (async () => {
    try {
      const [rests, cats, menu, addons] = await Promise.all([
        fetchAll<RestaurantRow>("/api/database/records/restaurants", 2000),
        fetchAll<CategoryRow>("/api/database/records/categories", 500),
        fetchAll<MenuItemRow>("/api/database/records/menu_items", 5000),
        fetchAll<AddonRow>("/api/database/records/addons", 5000),
      ]);

      const totalRows = rests.length + cats.length + menu.length + addons.length;
      if (totalRows === 0) {
        insforgeState.status = "empty";
        return { ok: true };
      }

      // group menu items by restaurant
      const menuByRest = new Map<string, Dish[]>();
      for (const m of menu) {
        if (m.available === false) continue;
        const rid = m.restaurant_id ?? "";
        const list = menuByRest.get(rid) ?? [];
        list.push(toDish(m));
        menuByRest.set(rid, list);
      }

      // group addons by dish
      const addonMap = new Map<string, AddonRow[]>();
      for (const a of addons) {
        if (a.available === false) continue;
        const list = addonMap.get(a.dish_id) ?? [];
        list.push(a);
        addonMap.set(a.dish_id, list);
      }
      insforgeState.addonsByDish = addonMap;

      // Backend is authoritative: when rows exist, REPLACE the seed arrays
      // entirely (no mock fallback). Empty tables leave seeds untouched so
      // screens degrade to their existing empty/demo state.
      if (rests.length) {
        restaurants.splice(0, restaurants.length, ...rests.map((row) => toRestaurant(row, menuByRest.get(row.id) ?? [])));

        // Rebuild the curated id lists from backend flags so trending /
        // recommended rails aren't pointing at removed seed dishes.
        const backendDishes = restaurants.flatMap((r) => r.menu);
        const popular = backendDishes.filter((d) => d.popular).map((d) => d.id);
        const trending = (popular.length ? popular : backendDishes.map((d) => d.id)).slice(0, 8);
        trendingDishIds.splice(0, trendingDishIds.length, ...trending);
        const recommended = backendDishes.map((d) => d.id).filter((id) => !trending.includes(id));
        recommendedDishIds.splice(
          0,
          recommendedDishIds.length,
          ...(recommended.length ? recommended : trending).slice(0, 6),
        );
      }

      if (cats.length) {
        categories.splice(0, categories.length, ...cats.filter((c) => c.active !== false).map(toCategory));
      }


      insforgeState.status = "ready";
      bumpCatalog();

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      insforgeState.status = "error";
      insforgeState.error = msg;
      // Reset so a retry can run.
      bootstrapPromise = null;
      return { ok: false, error: msg };
    }
  })();

  return bootstrapPromise;
}

/** Lookup add-ons for a dish (used by customer customization sheet). */
export function addonsForDish(dishId: string): AddonRow[] {
  return insforgeState.addonsByDish.get(dishId) ?? [];
}
