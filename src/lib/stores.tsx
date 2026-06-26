import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findRestaurant, type Dish, type Restaurant } from "./mock-data";

/* ============================================================
   CART
   ============================================================ */

export type CartItem = {
  lineId: string;
  dishId: string;
  name: string;
  image: string;
  price: number; // unit price including customizations
  qty: number;
  restaurantId: string;
  restaurantName: string;
  customizations: string[]; // e.g. ["Extra cheese", "Spicy: Hot"]
};

export type Coupon = { code: string; label: string; kind: "pct" | "freeship"; value: number };

const COUPONS: Coupon[] = [
  { code: "CRAVIO10", label: "10% off your order", kind: "pct", value: 0.1 },
  { code: "CRAVIO50", label: "50% off (max ₹800)", kind: "pct", value: 0.5 },
  { code: "FREESHIP", label: "Free delivery", kind: "freeship", value: 0 },
  { code: "NIGHT20", label: "20% off late-night", kind: "pct", value: 0.2 },
];

type CartCtx = {
  items: CartItem[];
  coupon: Coupon | null;
  restaurantId: string | null;
  addItem: (item: Omit<CartItem, "lineId" | "qty">, qty?: number) => { ok: boolean; reason?: string };
  removeItem: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
  applyCoupon: (code: string) => { ok: boolean; message: string };
  removeCoupon: () => void;
  totals: {
    subtotal: number;
    delivery: number;
    taxes: number;
    discount: number;
    total: number;
    itemCount: number;
  };
  restaurant: Restaurant | null;
};

const CartContext = createContext<CartCtx | null>(null);

const CART_KEY = "cravio_cart_v1";

function loadCart(): { items: CartItem[]; coupon: Coupon | null; restaurantId: string | null } {
  if (typeof window === "undefined") return { items: [], coupon: null, restaurantId: null };
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], coupon: null, restaurantId: null };
    return JSON.parse(raw);
  } catch {
    return { items: [], coupon: null, restaurantId: null };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadCart();
    setItems(saved.items);
    setCoupon(saved.coupon);
    setRestaurantId(saved.restaurantId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CART_KEY, JSON.stringify({ items, coupon, restaurantId }));
  }, [items, coupon, restaurantId]);

  const addItem: CartCtx["addItem"] = (item, qty = 1) => {
    if (restaurantId && restaurantId !== item.restaurantId && items.length > 0) {
      return { ok: false, reason: "different-restaurant" };
    }
    setRestaurantId(item.restaurantId);
    setItems((prev) => {
      // merge identical lines (same dish + customizations)
      const sig = `${item.dishId}|${item.customizations.join(",")}`;
      const existing = prev.find((p) => `${p.dishId}|${p.customizations.join(",")}` === sig);
      if (existing) {
        return prev.map((p) => (p === existing ? { ...p, qty: p.qty + qty } : p));
      }
      return [...prev, { ...item, qty, lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
    return { ok: true };
  };

  const removeItem: CartCtx["removeItem"] = (lineId) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.lineId !== lineId);
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  };

  const setQty: CartCtx["setQty"] = (lineId, qty) => {
    if (qty <= 0) return removeItem(lineId);
    setItems((prev) => prev.map((p) => (p.lineId === lineId ? { ...p, qty } : p)));
  };

  const clear = () => {
    setItems([]);
    setCoupon(null);
    setRestaurantId(null);
  };

  const applyCoupon: CartCtx["applyCoupon"] = (code) => {
    const found = COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase().trim());
    if (!found) return { ok: false, message: "That coupon doesn't exist" };
    setCoupon(found);
    return { ok: true, message: `${found.label} applied` };
  };

  const removeCoupon = () => setCoupon(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const itemCount = items.reduce((s, i) => s + i.qty, 0);
    const baseDelivery = subtotal === 0 ? 0 : 2.99;
    const freeShip = coupon?.kind === "freeship" || subtotal >= 25;
    const delivery = freeShip ? 0 : baseDelivery;
    const taxes = +(subtotal * 0.08).toFixed(2);
    let discount = 0;
    if (coupon?.kind === "pct") {
      discount = Math.min(subtotal * coupon.value, coupon.code === "CRAVIO50" ? 10 : Infinity);
    }
    const total = Math.max(0, subtotal + delivery + taxes - discount);
    return { subtotal: +subtotal.toFixed(2), delivery: +delivery.toFixed(2), taxes, discount: +discount.toFixed(2), total: +total.toFixed(2), itemCount };
  }, [items, coupon]);

  const restaurant = restaurantId ? findRestaurant(restaurantId) ?? null : null;

  return (
    <CartContext.Provider value={{ items, coupon, restaurantId, addItem, removeItem, setQty, clear, applyCoupon, removeCoupon, totals, restaurant }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

/* ============================================================
   FAVORITES
   ============================================================ */

type FavCtx = {
  restaurants: Set<string>;
  dishes: Set<string>;
  toggleRestaurant: (id: string) => void;
  toggleDish: (id: string) => void;
  isRestaurantFav: (id: string) => boolean;
  isDishFav: (id: string) => boolean;
};

const FavContext = createContext<FavCtx | null>(null);
const FAV_KEY = "cravio_favs_v1";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [restaurants, setR] = useState<Set<string>>(new Set());
  const [dishes, setD] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        setR(new Set(o.restaurants ?? []));
        setD(new Set(o.dishes ?? []));
      }
    } catch {/* ignore */}
  }, []);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify({ restaurants: [...restaurants], dishes: [...dishes] }));
  }, [restaurants, dishes]);

  const toggleRestaurant = (id: string) => setR((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDish = (id: string) => setD((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <FavContext.Provider value={{ restaurants, dishes, toggleRestaurant, toggleDish, isRestaurantFav: (id) => restaurants.has(id), isDishFav: (id) => dishes.has(id) }}>
      {children}
    </FavContext.Provider>
  );
}

export const useFavorites = () => {
  const ctx = useContext(FavContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
};

/* ============================================================
   ORDERS
   ============================================================ */

export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Order placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const STATUS_FLOW: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "ON_THE_WAY", "DELIVERED"];

export type Order = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  delivery: number;
  taxes: number;
  discount: number;
  status: OrderStatus;
  placedAt: number;
  addressLabel: string;
  addressLine: string;
  paymentLabel: string;
  driver: { name: string; vehicle: string; rating: number; phone: string };
  etaMins: number;
  // Customer preferences captured at checkout (ready for backend persistence)
  deliveryInstructions?: string;
  contactless?: boolean;
  notes?: string;
  couponCode?: string;
};

type OrdersCtx = {
  orders: Order[];
  placeOrder: (input: {
    items: CartItem[];
    totals: { subtotal: number; delivery: number; taxes: number; discount: number; total: number };
    restaurant: Restaurant;
    addressLabel: string;
    addressLine: string;
    paymentLabel: string;
    deliveryInstructions?: string;
    contactless?: boolean;
    notes?: string;
    couponCode?: string;
  }) => string;
  getOrder: (id: string) => Order | undefined;
  reorder: (id: string) => CartItem[] | null;
};

const OrdersContext = createContext<OrdersCtx | null>(null);
const ORDERS_KEY = "cravio_orders_v1";

const DRIVERS = [
  { name: "Aarav Mehta", vehicle: "Scooter · KA 03 9981", rating: 4.95, phone: "+1 555 0192" },
  { name: "Sofía Reyes", vehicle: "E-bike · CA 7741", rating: 4.9, phone: "+1 555 0144" },
  { name: "Liam Carter", vehicle: "Bike · NY 2210", rating: 4.88, phone: "+1 555 0177" },
  { name: "Yuki Tanaka", vehicle: "Scooter · TK 5520", rating: 4.97, phone: "+1 555 0102" },
];

function loadOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function advance(status: OrderStatus): OrderStatus {
  const idx = STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return status;
  return STATUS_FLOW[idx + 1];
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setOrders(loadOrders());
  }, []);

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }, [orders]);

  // Auto-advance any active orders periodically for the demo
  useEffect(() => {
    const t = setInterval(() => {
      setOrders((prev) => {
        let changed = false;
        const next = prev.map((o) => {
          if (o.status === "DELIVERED" || o.status === "CANCELLED") return o;
          const ageSec = (Date.now() - o.placedAt) / 1000;
          // PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → ON_THE_WAY → DELIVERED
          let target: OrderStatus = "PLACED";
          if (ageSec >= 60) target = "DELIVERED";
          else if (ageSec >= 42) target = "ON_THE_WAY";
          else if (ageSec >= 32) target = "PICKED_UP";
          else if (ageSec >= 22) target = "READY";
          else if (ageSec >= 10) target = "PREPARING";
          else if (ageSec >= 4) target = "ACCEPTED";
          if (target !== o.status) { changed = true; return { ...o, status: target }; }
          return o;
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const placeOrder: OrdersCtx["placeOrder"] = ({ items, totals, restaurant, addressLabel, addressLine, paymentLabel }) => {
    const id = `CRV${Math.floor(100000 + Math.random() * 900000)}`;
    const driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    const order: Order = {
      id,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantImage: restaurant.cover,
      items,
      ...totals,
      status: "PLACED",
      placedAt: Date.now(),
      addressLabel, addressLine, paymentLabel,
      driver,
      etaMins: restaurant.deliveryMins,
    };
    setOrders((prev) => [order, ...prev]);
    return id;
  };

  const getOrder = (id: string) => orders.find((o) => o.id === id);

  const reorder = (id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return null;
    return o.items;
  };

  // expose a helper to manually advance status (used by tracking dev controls — none surfaced)
  void advance;

  return (
    <OrdersContext.Provider value={{ orders, placeOrder, getOrder, reorder }}>
      {children}
    </OrdersContext.Provider>
  );
}

export const useOrders = () => {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
};

/* ============================================================
   APP UI STATE (location, etc.)
   ============================================================ */

type AppUICtx = {
  location: string;
  setLocation: (l: string) => void;
  recentSearches: string[];
  pushRecent: (s: string) => void;
  clearRecent: () => void;
};

const AppUIContext = createContext<AppUICtx | null>(null);
const UI_KEY = "cravio_ui_v1";

export function AppUIProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState("Westside · Apt 4");
  const [recentSearches, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.location) setLocationState(o.location);
        if (Array.isArray(o.recentSearches)) setRecent(o.recentSearches);
      }
    } catch {/* */}
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_KEY, JSON.stringify({ location, recentSearches }));
  }, [location, recentSearches]);

  const setLocation = (l: string) => setLocationState(l);
  const pushRecent = (s: string) => {
    const v = s.trim();
    if (!v) return;
    setRecent((prev) => [v, ...prev.filter((p) => p.toLowerCase() !== v.toLowerCase())].slice(0, 6));
  };
  const clearRecent = () => setRecent([]);

  return (
    <AppUIContext.Provider value={{ location, setLocation, recentSearches, pushRecent, clearRecent }}>
      {children}
    </AppUIContext.Provider>
  );
}

export const useAppUI = () => {
  const ctx = useContext(AppUIContext);
  if (!ctx) throw new Error("useAppUI must be used within AppUIProvider");
  return ctx;
};

/* ============================================================
   ROOT PROVIDER STACK
   ============================================================ */

export function CravioProviders({ children }: { children: ReactNode }) {
  return (
    <AppUIProvider>
      <FavoritesProvider>
        <OrdersProvider>
          <CartProvider>{children}</CartProvider>
        </OrdersProvider>
      </FavoritesProvider>
    </AppUIProvider>
  );
}

/* utility */
export const peekDish = (_d: Dish) => null;
