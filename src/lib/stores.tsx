import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findRestaurant, type Dish, type Restaurant } from "./mock-data";
import { useAuth } from "./auth-store";
import { currentPlatformSettings } from "./cms-store";
import { reverseGeocode } from "./geocode";
import { listTable } from "./insforge-crud";
import {
  listCampaigns, listRedemptions, eligibleCampaigns, evaluateCampaign, bestAutoCampaign,
  matchPromoCode, trackCampaignEvent, CAMPAIGN_TYPE_LABEL,
  type Campaign, type CampaignOutcome, type CampaignContext, type PaymentMethodKey,
} from "./campaigns-api";
import {
  listRedeemableCoupons, listCouponUsage, couponToCampaign, isHiddenCampaign,
  type Coupon as CouponRow,
} from "./coupons-api";

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

export type Coupon = {
  code: string;
  label: string;
  kind: "pct" | "flat" | "freeship" | "cashback" | "wallet";
  value: number;
  campaignId?: string;
};


export type PendingAdd = { item: Omit<CartItem, "lineId" | "qty">; qty: number };

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
    freeDeliveryEligible: boolean;
  };

  /** Live campaign engine state (server-authoritative rows from InsForge). */
  campaigns: Campaign[];
  /** Live coupon rows backing the coupon-derived offers in the pool. */
  coupons: CouponRow[];
  /** The campaign currently reducing this bill (manual code or auto-applied). */
  appliedCampaign: CampaignOutcome | null;
  /** Every campaign the customer qualifies for right now, best saving first. */
  eligibleOffers: CampaignOutcome[];
  /** Cashback / wallet credit earned after this order completes. */
  pendingRewards: { cashback: number; walletCredit: number };
  /** Re-evaluates offers against a chosen payment method. */
  setPaymentMethod: (m: PaymentMethodKey) => void;

  restaurant: Restaurant | null;
  /** Multi-restaurant conflict popup state. */
  pendingConflict: PendingAdd | null;
  confirmReplaceCart: () => void;
  dismissConflict: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

const CART_KEY = "cravio_cart_v1";

function loadCart(): { items: CartItem[]; restaurantId: string | null; campaignId?: string | null } {
  if (typeof window === "undefined") return { items: [], restaurantId: null };
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], restaurantId: null };
    return JSON.parse(raw);
  } catch {
    return { items: [], restaurantId: null };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingAdd | null>(null);

  // ---- campaign engine state (all server-sourced) ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [manualCampaignId, setManualCampaignId] = useState<string | null>(null);
  const [userRedemptions, setUserRedemptions] = useState<Record<string, number>>({});
  const [orderCount, setOrderCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>("card");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);

  useEffect(() => {
    const saved = loadCart();
    setItems(saved.items ?? []);
    setRestaurantId(saved.restaurantId ?? null);
    setManualCampaignId(saved.campaignId ?? null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CART_KEY, JSON.stringify({ items, restaurantId, campaignId: manualCampaignId }));
  }, [items, restaurantId, manualCampaignId]);

  // Live campaigns + coupons — refreshed on mount so admin/partner edits land
  // without a deploy. Coupons are projected onto the campaign shape so the
  // evaluator ranks both kinds of offer in one pool.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [camps, couponRows] = await Promise.all([listCampaigns(), listRedeemableCoupons()]);
      if (cancelled) return;
      setCoupons(couponRows);
      setCampaigns([...camps, ...couponRows.map(couponToCampaign)]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Per-customer eligibility inputs.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = user?.id;
      // Scoped reads: only fetch usage records for the active user if signed in.
      // If signed out, we show auto-applied campaigns but no user-specific stats.
      const [reds, couponUsage, orders] = await Promise.all([
        userId ? listRedemptions({ user_id: userId }) : Promise.resolve([]),
        userId ? listCouponUsage({ user_id: userId }) : Promise.resolve([]),
        userId ? listTable<{ id: string }>("orders", { customer_id: `eq.${userId}`, limit: 200 }) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      const map: Record<string, number> = {};
      reds.forEach((r) => { map[r.campaign_id] = (map[r.campaign_id] ?? 0) + 1; });
      couponUsage.forEach((u) => {
        if (!u.coupon_id) return;
        map[u.coupon_id] = (map[u.coupon_id] ?? 0) + 1;
      });
      setUserRedemptions(map);
      setOrderCount(orders.length);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);


  const insertItem = (item: Omit<CartItem, "lineId" | "qty">, qty: number) => {
    setRestaurantId(item.restaurantId);
    setItems((prev) => {
      const sig = `${item.dishId}|${item.customizations.join(",")}`;
      const existing = prev.find((p) => `${p.dishId}|${p.customizations.join(",")}` === sig);
      if (existing) return prev.map((p) => (p === existing ? { ...p, qty: p.qty + qty } : p));
      return [...prev, { ...item, qty, lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
  };

  const addItem: CartCtx["addItem"] = (item, qty = 1) => {
    if (restaurantId && restaurantId !== item.restaurantId && items.length > 0) {
      setPendingConflict({ item, qty });
      return { ok: false, reason: "different-restaurant" };
    }
    insertItem(item, qty);
    return { ok: true };
  };

  const confirmReplaceCart = () => {
    if (!pendingConflict) return;
    const p = pendingConflict;
    setItems([]); setManualCampaignId(null); setRestaurantId(p.item.restaurantId);
    // queue insert after state settles
    setTimeout(() => insertItem(p.item, p.qty), 0);
    setPendingConflict(null);
  };
  const dismissConflict = () => setPendingConflict(null);

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

  const clear = () => { setItems([]); setManualCampaignId(null); setRestaurantId(null); };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const baseDelivery = subtotal === 0 ? 0 : 2.99;

  const ctx = useMemo<CampaignContext>(() => ({
    subtotal,
    deliveryFee: baseDelivery,
    userId: user?.id,
    restaurantId,
    paymentMethod,
    orderCount,
    userRedemptions,
    cheapestItemPrice: items.length ? Math.min(...items.map((i) => i.price)) : 0,
  }), [subtotal, baseDelivery, user?.id, restaurantId, paymentMethod, orderCount, userRedemptions, items]);

  const eligibleOffers = useMemo(
    () => eligibleCampaigns(campaigns, ctx).filter((o) => !isHiddenCampaign(o.campaign)),
    [campaigns, ctx],
  );

  const appliedCampaign = useMemo<CampaignOutcome | null>(() => {
    if (manualCampaignId) {
      const c = campaigns.find((x) => x.id === manualCampaignId);
      if (c) {
        const out = evaluateCampaign(c, ctx);
        if (out.eligible) return out;
      }
    }
    return bestAutoCampaign(campaigns, ctx);
  }, [manualCampaignId, campaigns, ctx]);

  const applyCoupon: CartCtx["applyCoupon"] = (code) => {
    const res = matchPromoCode(campaigns, code, ctx);
    if ("error" in res) return { ok: false, message: res.error };
    setManualCampaignId(res.campaign.id);
    trackCampaignEvent(res.campaign.id, "apply", user?.id);
    return { ok: true, message: `${res.campaign.name} applied` };
  };

  const removeCoupon = () => setManualCampaignId(null);

  const coupon = useMemo<Coupon | null>(() => {
    if (!appliedCampaign) return null;
    const c = appliedCampaign.campaign;
    const kind: Coupon["kind"] =
      appliedCampaign.freeDelivery ? "freeship"
        : appliedCampaign.walletCredit > 0 ? "wallet"
          : appliedCampaign.cashback > 0 ? "cashback"
            : c.discount_type === "percent" ? "pct" : "flat";
    return {
      code: c.promo_code || c.name.toUpperCase().replace(/\s+/g, "").slice(0, 12),
      label: c.description || CAMPAIGN_TYPE_LABEL[c.type] || c.name,
      kind,
      value: c.discount_value ?? 0,
      campaignId: c.id,
    };
  }, [appliedCampaign]);

  const totals = useMemo(() => {
    const itemCount = items.reduce((s, i) => s + i.qty, 0);
    const freeMin = currentPlatformSettings.freeDeliveryMin ?? 25;
    const freeShip = !!appliedCampaign?.freeDelivery || subtotal >= freeMin;
    const delivery = freeShip ? 0 : baseDelivery;
    const taxes = +(subtotal * 0.08).toFixed(2);
    const discount = appliedCampaign?.discount ?? 0;
    const total = Math.max(0, subtotal + delivery + taxes - discount);
    return {
      subtotal: +subtotal.toFixed(2),
      delivery: +delivery.toFixed(2),
      taxes,
      discount: +discount.toFixed(2),
      total: +total.toFixed(2),
      itemCount,
      freeDeliveryEligible: freeShip,
    };
  }, [items, subtotal, baseDelivery, appliedCampaign]);

  const pendingRewards = useMemo(
    () => ({ cashback: appliedCampaign?.cashback ?? 0, walletCredit: appliedCampaign?.walletCredit ?? 0 }),
    [appliedCampaign],
  );

  const restaurant = restaurantId ? findRestaurant(restaurantId) ?? null : null;

  return (
    <CartContext.Provider value={{ items, coupon, coupons, restaurantId, addItem, removeItem, setQty, clear, applyCoupon, removeCoupon, totals, campaigns, appliedCampaign, eligibleOffers, pendingRewards, setPaymentMethod, restaurant, pendingConflict, confirmReplaceCart, dismissConflict }}>
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

type FavRow = { id?: string; user_id?: string; restaurant_id?: string; dish_id?: string; kind?: "restaurant" | "dish" };

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [restaurants, setR] = useState<Set<string>>(new Set());
  const [dishes, setD] = useState<Set<string>>(new Set());
  const rowIndexRef = useRef<Map<string, string>>(new Map()); // key: `${kind}:${id}` -> row id

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { listTable } = await import("./insforge-crud");
      const rows = await listTable<FavRow>("favorites");
      if (cancelled) return;
      const rSet = new Set<string>();
      const dSet = new Set<string>();
      rowIndexRef.current.clear();
      for (const row of rows) {
        if (row.restaurant_id) {
          rSet.add(row.restaurant_id);
          if (row.id) rowIndexRef.current.set(`restaurant:${row.restaurant_id}`, row.id);
        }
        if (row.dish_id) {
          dSet.add(row.dish_id);
          if (row.id) rowIndexRef.current.set(`dish:${row.dish_id}`, row.id);
        }
      }
      setR(rSet); setD(dSet);
    })();
    return () => { cancelled = true; };
  }, []);

  const mirror = async (kind: "restaurant" | "dish", id: string, add: boolean) => {
    const { createRecord, deleteRecord } = await import("./insforge-crud");
    const key = `${kind}:${id}`;
    if (add) {
      const payload: Record<string, unknown> = kind === "restaurant" ? { restaurant_id: id, kind } : { dish_id: id, kind };
      const created = await createRecord<{ id: string }>("favorites", payload);
      if (created?.id) rowIndexRef.current.set(key, created.id);
    } else {
      const rowId = rowIndexRef.current.get(key);
      if (rowId) { await deleteRecord("favorites", rowId); rowIndexRef.current.delete(key); }
    }
  };

  const toggleRestaurant = (id: string) => setR((p) => {
    const n = new Set(p); const willAdd = !n.has(id);
    willAdd ? n.add(id) : n.delete(id);
    void mirror("restaurant", id, willAdd);
    return n;
  });
  const toggleDish = (id: string) => setD((p) => {
    const n = new Set(p); const willAdd = !n.has(id);
    willAdd ? n.add(id) : n.delete(id);
    void mirror("dish", id, willAdd);
    return n;
  });

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
  // Customer preferences captured at checkout (persisted in orders.items.meta)
  deliveryInstructions?: string;
  contactless?: boolean;
  notes?: string;
  couponCode?: string;
  // Server-side fields
  driverId?: string;
  otp?: string;
  paymentStatus?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
};

type OrdersCtx = {
  orders: Order[];
  loading: boolean;
  refresh: () => Promise<void>;
  placeOrder: (input: {
    items: CartItem[];
    totals: { subtotal: number; delivery: number; taxes: number; discount: number; total: number };
    restaurant: Restaurant;
    addressLabel: string;
    addressLine: string;
    paymentLabel: string;
    paymentMethod?: string;
    deliveryInstructions?: string;
    contactless?: boolean;
    notes?: string;
    couponCode?: string;
  }) => Promise<{ ok: boolean; orderId?: string; message?: string }>;
  getOrder: (id: string) => Order | undefined;
  reorder: (id: string) => CartItem[] | null;
  cancelOrder: (id: string, reason?: string) => Promise<{ ok: boolean; message: string }>;
  refunds: Record<string, "none" | "pending" | "refunded">;
  setRefundStatus: (id: string, status: "none" | "pending" | "refunded") => void;
};


const OrdersContext = createContext<OrdersCtx | null>(null);

/**
 * Orders are server-authoritative: every read comes from InsForge, every
 * write goes to InsForge first. Nothing is persisted in localStorage, so a
 * fresh login on any device shows the complete history.
 */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const customerId = user?.id;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refunds, setRefunds] = useState<Record<string, "none" | "pending" | "refunded">>({});

  const refresh = useCallback(async () => {
    if (!customerId) {
      setOrders([]);
      return;
    }
    const { fetchCustomerOrders } = await import("./orders-api");
    const rows = await fetchCustomerOrders(customerId);
    setOrders(rows);
  }, [customerId]);


  // Initial load + light polling while the tab is visible (server is the
  // source of truth for live status; no websockets needed for MVP).
  useEffect(() => {
    let cancelled = false;
     
    setLoading(true);
    const run = async () => {
      if (!customerId) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const { fetchCustomerOrders } = await import("./orders-api");
      const rows = await fetchCustomerOrders(customerId);
      if (!cancelled) { setOrders(rows); setLoading(false); }
    };

    void run();
    const iv = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void run();
    }, 12000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [customerId]);

  const placeOrder: OrdersCtx["placeOrder"] = async ({
    items, totals, restaurant, addressLabel, addressLine, paymentLabel, paymentMethod,
    deliveryInstructions, contactless, notes, couponCode,
  }) => {
     
    const { createOrder } = await import("./orders-api");
    const created = await createOrder({
      customerId: customerId!,

      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantImage: restaurant.cover,
      items,
      totals,
      addressLabel,
      addressLine,
      paymentMethod: paymentMethod ?? "cash",
      paymentLabel,
      deliveryInstructions,
      contactless,
      notes,
      couponCode,
      etaMins: restaurant.deliveryMins,
    });
    if (!created) return { ok: false, message: "Could not place the order. Please try again." };
    setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
    return { ok: true, orderId: created.id };
  };

  const getOrder = (id: string) => orders.find((o) => o.id === id);
  const reorder = (id: string) => orders.find((x) => x.id === id)?.items ?? null;

  const cancelOrder: OrdersCtx["cancelOrder"] = async (id, reason) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return { ok: false, message: "Order not found" };
    const lockedAfter: OrderStatus[] = ["PICKED_UP", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    if (lockedAfter.includes(o.status)) return { ok: false, message: "Too late to cancel — the rider is on the way" };
    const { patchOrder, patchPaymentByOrder } = await import("./orders-api");
    const ok = await patchOrder(id, { status: "CANCELLED", payment_status: "CANCELLED" });
    if (!ok) return { ok: false, message: "Could not cancel right now — please try again" };
    void patchPaymentByOrder(id, { status: "CANCELLED" });
    setOrders((prev) => prev.map((x) => (x.id === id ? { ...x, status: "CANCELLED", notes: reason ? `Cancelled: ${reason}` : x.notes } : x)));
    return { ok: true, message: "Order cancelled" };
  };

  const setRefundStatus: OrdersCtx["setRefundStatus"] = (id, status) =>
    setRefunds((p) => ({ ...p, [id]: status }));

  return (
    <OrdersContext.Provider value={{ orders, loading, refresh, placeOrder, getOrder, reorder, cancelOrder, refunds, setRefundStatus }}>
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

type LocationPermission = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

type AppUICtx = {
  location: string;
  secondaryLocation?: string;
  setLocation: (l: string, coords?: { lat: number; lng: number }, secondary?: string) => void;
  userCoords: { lat: number; lng: number } | null;
  recentSearches: string[];
  pushRecent: (s: string) => void;
  clearRecent: () => void;
  locationPermission: LocationPermission;
  detectingLocation: boolean;
  detectLocation: () => Promise<{ ok: boolean; message: string }>;
  /** Customer-wide pure-veg filter. Persisted to localStorage. */
  vegMode: boolean;
  setVegMode: (on: boolean) => void;
};

const AppUIContext = createContext<AppUICtx | null>(null);
const UI_KEY = "cravio_ui_v1";

// Reverse geocoding is handled by src/lib/geocode.ts (Google Maps Geocoding).


export function AppUIProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState("Westside · Apt 4");
  const [secondaryLocation, setSecondaryState] = useState<string | undefined>();
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [recentSearches, setRecent] = useState<string[]>([]);
  const [locationPermission, setLocationPermission] = useState<LocationPermission>("unknown");
  const [detectingLocation, setDetecting] = useState(false);
  const [vegMode, setVegModeState] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.location) {
          setLocationState(o.location);
          // If the stored location is raw coordinates, trigger a resolution immediately
          if (o.userCoords && /^-?\d+\.\d+, -?\d+\.\d+$/.test(o.location)) {
            void (async () => {
              try {
                const resolved = await reverseGeocode(o.userCoords.lat, o.userCoords.lng);
                const parts = resolved.split(',').map(s => s.trim());
                if (parts.length > 1) {
                  setLocationState(parts[0]);
                  setSecondaryState(parts.slice(1).join(', '));
                } else {
                  setLocationState(resolved);
                }
              } catch (e) {
                console.error("Failed to resolve stored coordinates:", e);
              }
            })();
          }
        }
        if (o.secondaryLocation) setSecondaryState(o.secondaryLocation);
        if (o.userCoords) setUserCoords(o.userCoords);
        if (Array.isArray(o.recentSearches)) setRecent(o.recentSearches);
        if (typeof o.vegMode === "boolean") setVegModeState(o.vegMode);
      }
    } catch {/* */}
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_KEY, JSON.stringify({ location, secondaryLocation, userCoords, recentSearches, vegMode }));
  }, [location, secondaryLocation, userCoords, recentSearches, vegMode]);

  const setVegMode = (on: boolean) => setVegModeState(on);

  const setLocation: AppUICtx["setLocation"] = async (l, coords, secondary) => {
    // If we receive raw coordinates as the label and have coords, resolve it
    if (coords && /^-?\d+\.\d+, -?\d+\.\d+$/.test(l)) {
      setLocationState("📍 Locating...");
      try {
        const resolved = await reverseGeocode(coords.lat, coords.lng);
        const parts = resolved.split(',').map(s => s.trim());
        if (parts.length > 1) {
          setLocationState(parts[0]);
          setSecondaryState(parts.slice(1).join(', '));
        } else {
          setLocationState(resolved);
          setSecondaryState(undefined);
        }
      } catch (e) {
        setLocationState("📍 Select delivery location");
      }
    } else {
      setLocationState(l);
      setSecondaryState(secondary);
    }
    if (coords) setUserCoords(coords);
  };
  const pushRecent = (s: string) => {
    const v = s.trim();
    if (!v) return;
    setRecent((prev) => [v, ...prev.filter((p) => p.toLowerCase() !== v.toLowerCase())].slice(0, 6));
  };
  const clearRecent = () => setRecent([]);

  const detectLocation: AppUICtx["detectLocation"] = () =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setLocationPermission("unsupported");
        resolve({ ok: false, message: "Geolocation isn't supported on this device" });
        return;
      }
      setDetecting(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setUserCoords({ lat, lng });
          setLocationPermission("granted");
          const label = await reverseGeocode(lat, lng);
          
          // Basic logic to split label for secondary if it contains a comma
          // The reverseGeocode now returns more specific labels
          const parts = label.split(',').map(s => s.trim());
          if (parts.length > 1) {
            setLocationState(parts[0]);
            setSecondaryState(parts.slice(1).join(', '));
          } else {
            setLocationState(label);
            setSecondaryState(undefined);
          }
          
          setDetecting(false);
          resolve({ ok: true, message: label });
        },
        (err) => {
          setDetecting(false);
          if (err.code === err.PERMISSION_DENIED) {
            setLocationPermission("denied");
            resolve({ ok: false, message: "Location permission denied" });
          } else if (err.code === err.TIMEOUT) {
            resolve({ ok: false, message: "Location request timed out — try again" });
          } else {
            resolve({ ok: false, message: "Couldn't fetch your location" });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });

  return (
    <AppUIContext.Provider value={{ 
      location, 
      secondaryLocation, 
      setLocation, 
      userCoords, 
      recentSearches, 
      pushRecent, 
      clearRecent, 
      locationPermission, 
      detectingLocation, 
      detectLocation, 
      vegMode, 
      setVegMode 
    }}>
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

import { CmsProvider } from "./cms-store";
import { AuthProvider } from "./auth-store";
import { ScoobixExtrasProviders } from "./scoobix-extras";
import { ScoobixLoyaltyProviders } from "./scoobix-loyalty";

export function ScoobixProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CmsProvider>
            <AppUIProvider>
              <FavoritesProvider>
                <OrdersProvider>
                  <ScoobixLoyaltyProviders>
                    <ScoobixExtrasProviders>
                      <CartProvider>{children}</CartProvider>
                    </ScoobixExtrasProviders>
                  </ScoobixLoyaltyProviders>
                </OrdersProvider>

              </FavoritesProvider>
            </AppUIProvider>
      </CmsProvider>
    </AuthProvider>
  );
}



/* utility */
export const peekDish = (_d: Dish) => null;
