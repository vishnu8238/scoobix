/**
 * Backend-ready field maps mirroring the future DB schema 1:1.
 *
 * These are kept in a separate module so that the lightweight UI mock data
 * (`mock-data.ts`) stays unchanged, but every screen can already look up the
 * fields it will need at backend connection time.
 *
 * Restaurant fields:
 *   id, status, open_close, commission, rating, latitude, longitude, delivery_radius
 * Dish fields:
 *   id, available, veg_type, category, price, recommended, best_seller
 * Order fields:
 *   customer_id, restaurant_id, driver_id, status, payment_status,
 *   delivery_fee, discount
 */

import { restaurants, allDishes } from "./mock-data";

export type RestaurantStatusFlag = "active" | "pending" | "suspended";
export type OpenClose = { open: string; close: string; is_open: boolean };

export type RestaurantBackendRow = {
  id: string;
  status: RestaurantStatusFlag;
  open_close: OpenClose;
  commission: number;
  rating: number;
  latitude: number;
  longitude: number;
  delivery_radius: number; // km
};

const RESTAURANT_COMMISSIONS: Record<string, number> = {
  "verdant-kitchen": 15,
  "trattoria-verde": 18,
  "sakura-sushi": 20,
  "spice-symphony": 17,
  "char-and-crust": 16,
  "smoke-and-wings": 19,
  "casa-verde": 15,
  "sweet-atelier": 22,
};

const RESTAURANT_COORDS: Record<string, { lat: number; lng: number; radius: number }> = {
  "verdant-kitchen":  { lat: 12.9716, lng: 77.5946, radius: 6 },
  "trattoria-verde":  { lat: 12.9352, lng: 77.6245, radius: 5 },
  "sakura-sushi":     { lat: 12.9784, lng: 77.6408, radius: 4 },
  "spice-symphony":   { lat: 12.9606, lng: 77.6486, radius: 6 },
  "char-and-crust":   { lat: 12.9279, lng: 77.6271, radius: 5 },
  "smoke-and-wings":  { lat: 13.0010, lng: 77.5705, radius: 5 },
  "casa-verde":       { lat: 12.9100, lng: 77.6500, radius: 4 },
  "sweet-atelier":    { lat: 12.9540, lng: 77.5800, radius: 3 },
};

export const restaurantBackendRows: RestaurantBackendRow[] = restaurants.map((r) => {
  const c = RESTAURANT_COORDS[r.id] ?? { lat: 12.97, lng: 77.59, radius: 5 };
  return {
    id: r.id,
    status: "active",
    open_close: { open: "10:00", close: "23:00", is_open: true },
    commission: RESTAURANT_COMMISSIONS[r.id] ?? 18,
    rating: r.rating,
    latitude: c.lat,
    longitude: c.lng,
    delivery_radius: c.radius,
  };
});

export function restaurantBackend(id: string): RestaurantBackendRow | undefined {
  return restaurantBackendRows.find((r) => r.id === id);
}

export type VegType = "veg" | "non_veg" | "egg";

export type DishBackendRow = {
  id: string;
  restaurant_id: string;
  available: boolean;
  veg_type: VegType;
  category: string;
  price: number;
  recommended: boolean;
  best_seller: boolean;
};

export const dishBackendRows: DishBackendRow[] = (() => {
  const list = allDishes();
  return list.map((d, i) => ({
    id: d.id,
    restaurant_id: restaurants.find((r) => r.menu.some((m) => m.id === d.id))?.id ?? "",
    available: true,
    veg_type: d.veg ? "veg" : "non_veg",
    category: d.category,
    price: d.price,
    recommended: !!d.popular,
    best_seller: i % 5 === 0,
  }));
})();

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export type OrderBackendRow = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  driver_id?: string;
  status:
    | "PLACED" | "ACCEPTED" | "PREPARING" | "READY"
    | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED";
  payment_status: PaymentStatus;
  delivery_fee: number;
  discount: number;
  amount: number;
};

/** Adapter: project an in-memory Order onto the backend row shape. */
export function toOrderBackendRow(o: {
  id: string;
  restaurantId: string;
  status: OrderBackendRow["status"];
  delivery: number;
  discount: number;
  total: number;
  driver?: { name: string };
}): OrderBackendRow {
  return {
    id: o.id,
    customer_id: "demo-customer",
    restaurant_id: o.restaurantId,
    driver_id: o.driver?.name ? `drv-${o.driver.name.split(" ")[0].toLowerCase()}` : undefined,
    status: o.status,
    payment_status: o.status === "CANCELLED" ? "refunded" : "paid",
    delivery_fee: o.delivery,
    discount: o.discount,
    amount: o.total,
  };
}
