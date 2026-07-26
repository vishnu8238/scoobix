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


export const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_ANON_KEY =
  "anon_f8c2fce9afe385f45eb6d00d434eb365833a70386175df3707743df3b751b102";

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
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal,
  });
  if (!res.ok) throw new Error(`InsForge ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------- writes ----------

/**
 * Best-effort: insert an order + its items into InsForge. Never throws —
 * UI keeps working on the local optimistic order if the backend is down.
 */
export async function submitOrderToBackend(input: {
  orderId: string;
  customerId: string;
  restaurantId: string;
  total: number;
  status: string;
  items: { dish_id: string; name: string; price: number; qty: number; addons?: string[] }[];
}): Promise<{ ok: boolean }> {
  try {
    await ifFetch("/api/database/records/orders", undefined, {
      method: "POST",
      body: JSON.stringify({
        id: input.orderId,
        customer_id: input.customerId,
        restaurant_id: input.restaurantId,
        total_price: input.total,
        status: input.status,
      }),
    });
    await Promise.all(
      input.items.map((it) =>
        ifFetch("/api/database/records/order_items", undefined, {
          method: "POST",
          body: JSON.stringify({
            order_id: input.orderId,
            dish_id: it.dish_id,
            name: it.name,
            price: it.price,
            quantity: it.qty,
            addons: it.addons ?? [],
          }),
        }).catch(() => null),
      ),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ---------- partner-side writes (best-effort, never throw) ----------

async function ifWrite(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${INSFORGE_URL}${path}`, {
      method,
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
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
  return ifWrite(`/api/database/records/restaurants/${id}`, "PATCH", patch);
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
    return ifWrite(`/api/database/records/menu_items/${item.id}`, "PATCH", item);
  }
  return ifWrite(`/api/database/records/menu_items`, "POST", item);
}

export function deleteMenuItem(id: string) {
  return ifWrite(`/api/database/records/menu_items/${id}`, "DELETE");
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
    return ifWrite(`/api/database/records/addons/${addon.id}`, "PATCH", addon);
  }
  return ifWrite(`/api/database/records/addons`, "POST", addon);
}

export function deleteAddon(id: string) {
  return ifWrite(`/api/database/records/addons/${id}`, "DELETE");
}

/** Order lifecycle for partner. */
export function updateOrderStatus(
  id: string,
  patch: { status?: string; prep_minutes?: number; reject_reason?: string },
) {
  return ifWrite(`/api/database/records/orders/${id}`, "PATCH", patch);
}

// ---------- rider-side writes (best-effort, never throw) ----------

/** Toggle driver online/offline. */
export function setDriverOnline(driverId: string, online: boolean) {
  return ifWrite(`/api/database/records/drivers/${driverId}`, "PATCH", { online_status: online });
}

/** Accept a delivery request — claim the order for this driver. */
export function acceptDeliveryRequest(orderId: string, driverId: string) {
  return ifWrite(`/api/database/records/orders/${orderId}`, "PATCH", {
    driver_id: driverId,
    status: "PICKED_UP",
  });
}

/** Driver-side order status update (READY → PICKED_UP → DELIVERED, etc.). */
export function updateDeliveryStatus(orderId: string, status: string) {
  return ifWrite(`/api/database/records/orders/${orderId}`, "PATCH", { status });
}

/** Append a live-location ping for the driver. */
export function pingDriverLocation(driverId: string, lat: number, lng: number) {
  return ifWrite(`/api/database/records/driver_tracking`, "POST", {
    driver_id: driverId,
    latitude: lat,
    longitude: lng,
    timestamp: new Date().toISOString(),
  });
}

// ---------- admin-side writes (best-effort, never throw) ----------

/** Generic record CRUD — for admin pages with diverse tables. */
export function adminCreate(table: string, record: Record<string, unknown>) {
  return ifWrite(`/api/database/records/${table}`, "POST", record);
}
export function adminPatch(table: string, id: string, patch: Record<string, unknown>) {
  return ifWrite(`/api/database/records/${table}/${id}`, "PATCH", patch);
}
export function adminDelete(table: string, id: string) {
  return ifWrite(`/api/database/records/${table}/${id}`, "DELETE");
}

/** Admin-set commission %. */
export function setRestaurantCommission(id: string, commission: number) {
  return ifWrite(`/api/database/records/restaurants/${id}`, "PATCH", { commission });
}

/** Admin approve/reject/suspend a restaurant. */
export function setRestaurantApprovalStatus(id: string, status: "approved" | "rejected" | "suspended" | "pending") {
  return ifWrite(`/api/database/records/restaurants/${id}`, "PATCH", { status });
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
  return ifWrite(`/api/database/records/meal_subscriptions/${id}`, "PATCH", patch);
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
  return ifWrite(`/api/database/records/bulk_requests/${id}`, "PATCH", { status });
}

export function createGroupCart(session: { id: string; host_id: string; restaurant_id: string }) {
  return ifWrite(`/api/database/records/group_carts`, "POST", session);
}
export function getGroupCartRow(id: string) {
  return ifFetch<Record<string, unknown>>(`/api/database/records/group_carts/${id}`).catch(() => null);
}
export function updateGroupCart(id: string, patch: Record<string, unknown>) {
  return ifWrite(`/api/database/records/group_carts/${id}`, "PATCH", patch);
}

export function getSpotlightRow() {
  return ifFetch<Record<string, unknown>[]>(`/api/database/records/spotlight?limit=1`).catch(() => [] as Record<string, unknown>[]);
}
export function setSpotlight(record: Record<string, unknown>) {
  return ifWrite(`/api/database/records/spotlight`, "POST", record);
}

export function scheduleOrder(orderId: string, iso: string) {
  return ifWrite(`/api/database/records/orders/${orderId}`, "PATCH", { scheduled_for: iso });
}
export function assignBatch(orderId: string, batchId: string) {
  return ifWrite(`/api/database/records/orders/${orderId}`, "PATCH", { batch_id: batchId });
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

export type InsForgeStatus = "idle" | "loading" | "ready" | "error" | "empty";

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
        ifFetch<RestaurantRow[]>("/api/database/records/restaurants?limit=200").catch(() => [] as RestaurantRow[]),
        ifFetch<CategoryRow[]>("/api/database/records/categories?limit=200").catch(() => [] as CategoryRow[]),
        ifFetch<MenuItemRow[]>("/api/database/records/menu_items?limit=2000").catch(() => [] as MenuItemRow[]),
        ifFetch<AddonRow[]>("/api/database/records/addons?limit=2000").catch(() => [] as AddonRow[]),
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
