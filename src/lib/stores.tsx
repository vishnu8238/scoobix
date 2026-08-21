import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findRestaurant, type Dish, type Restaurant } from "./mock-data";
import { useAuth } from "./auth-store";
import { CmsProvider, currentPlatformSettings } from "./cms-store";
import { listTable } from "./insforge-crud";
import {
  listCampaigns, eligibleCampaigns, evaluateCampaign, bestAutoCampaign,
  matchPromoCode, trackCampaignEvent, CAMPAIGN_TYPE_LABEL,
  type Campaign, type CampaignOutcome, type CampaignContext, type PaymentMethodKey,
} from "./campaigns-api";
import {
  listRedeemableCoupons, listCouponUsage, couponToCampaign, isHiddenCampaign,
  type Coupon as CouponRow,
} from "./coupons-api";
import { listRedemptions } from "./campaigns-api";

/* ============================================================
   CART
   ============================================================ */

export type CartItem = {
  lineId: string;
  dishId: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  restaurantId: string;
  restaurantName: string;
  customizations: string[];
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
  campaigns: Campaign[];
  coupons: CouponRow[];
  appliedCampaign: CampaignOutcome | null;
  eligibleOffers: CampaignOutcome[];
  pendingRewards: { cashback: number; walletCredit: number };
  setPaymentMethod: (m: PaymentMethodKey) => void;
  restaurant: Restaurant | null;
  pendingConflict: PendingAdd | null;
  confirmReplaceCart: () => void;
  dismissConflict: () => void;
};

const CartContext = createContext<CartCtx | null>(null);
const CART_KEY = "cravio_cart_v1";

function loadCart() {
  if (typeof window === "undefined") return { items: [], restaurantId: null };
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : { items: [], restaurantId: null };
  } catch { return { items: [], restaurantId: null }; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingAdd | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [manualCampaignId, setManualCampaignId] = useState<string | null>(null);
  const [userRedemptions, setUserRedemptions] = useState<Record<string, number>>({});
  const [orderCount, setOrderCount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>("card");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);

  useEffect(() => {
    const saved = loadCart();
    if (saved.items) setItems(saved.items);
    if (saved.restaurantId) setRestaurantId(saved.restaurantId);
    if (saved.campaignId) setManualCampaignId(saved.campaignId);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CART_KEY, JSON.stringify({ items, restaurantId, campaignId: manualCampaignId }));
    }
  }, [items, restaurantId, manualCampaignId]);

  useEffect(() => {
    void (async () => {
      const [camps, rows] = await Promise.all([listCampaigns(), listRedeemableCoupons()]);
      setCoupons(rows || []);
      setCampaigns([...(camps || []), ...(rows || []).map(couponToCampaign)]);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const [reds, usage, orders] = await Promise.all([
        listRedemptions({ user_id: user.id }),
        listCouponUsage({ user_id: user.id }),
        listTable<{ id: string }>("orders", { customer_id: `eq.${user.id}`, limit: 200 }),
      ]);
      const map: Record<string, number> = {};
      (reds || []).forEach(r => map[r.campaign_id] = (map[r.campaign_id] ?? 0) + 1);
      (usage || []).forEach(u => u.coupon_id && (map[u.coupon_id] = (map[u.coupon_id] ?? 0) + 1));
      setUserRedemptions(map);
      setOrderCount((orders || []).length);
    })();
  }, [user?.id]);

  const insertItem = useCallback((item: Omit<CartItem, "lineId" | "qty">, qty: number) => {
    setRestaurantId(item.restaurantId);
    setItems(prev => {
      const sig = `${item.dishId}|${item.customizations.sort().join(",")}`;
      const existing = prev.find(p => `${p.dishId}|${p.customizations.sort().join(",")}` === sig);
      if (existing) return prev.map(p => p === existing ? { ...p, qty: p.qty + qty } : p);
      return [...prev, { ...item, qty, lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "lineId" | "qty">, qty = 1) => {
    if (restaurantId && restaurantId !== item.restaurantId && items.length > 0) {
      setPendingConflict({ item, qty });
      return { ok: false, reason: "different-restaurant" };
    }
    insertItem(item, qty);
    return { ok: true };
  }, [restaurantId, items.length, insertItem]);

  const confirmReplaceCart = () => {
    if (!pendingConflict) return;
    const { item, qty } = pendingConflict;
    setItems([]); setRestaurantId(item.restaurantId);
    setTimeout(() => insertItem(item, qty), 0);
    setPendingConflict(null);
  };

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

  const totals = useMemo(() => {
    const itemCount = items.reduce((s, i) => s + i.qty, 0);
    const freeMin = currentPlatformSettings.freeDeliveryMin ?? 25;
    const freeShip = !!appliedCampaign?.freeDelivery || subtotal >= freeMin;
    const delivery = freeShip ? 0 : baseDelivery;
    const taxes = subtotal * 0.08;
    const discount = appliedCampaign?.discount ?? 0;
    const total = Math.max(0, subtotal + delivery + taxes - discount);
    return {
      subtotal, delivery, taxes, discount, total, itemCount, freeDeliveryEligible: freeShip,
    };
  }, [items, subtotal, baseDelivery, appliedCampaign]);

  const pendingRewards = useMemo(
    () => ({ cashback: appliedCampaign?.cashback ?? 0, walletCredit: appliedCampaign?.walletCredit ?? 0 }),
    [appliedCampaign],
  );

  const applyCoupon = useCallback((code: string) => {
    const res = matchPromoCode(campaigns, code, ctx);
    if ("error" in res) return { ok: false, message: res.error };
    setManualCampaignId(res.campaign.id);
    trackCampaignEvent(res.campaign.id, "apply", user?.id);
    return { ok: true, message: `${res.campaign.name} applied` };
  }, [campaigns, ctx, user?.id]);

  return (
    <CartContext.Provider value={{
      items, restaurantId, addItem, removeItem: (id) => setItems(prev => prev.filter(p => p.lineId !== id)),
      setQty: (id, q) => setItems(prev => prev.map(p => p.lineId === id ? { ...p, qty: q } : p)),
      clear: () => { setItems([]); setRestaurantId(null); },
      totals, campaigns, coupons, appliedCampaign, eligibleOffers, pendingRewards,
      setPaymentMethod, restaurant: restaurantId ? findRestaurant(restaurantId) ?? null : null,
      pendingConflict, confirmReplaceCart, dismissConflict: () => setPendingConflict(null),
      coupon: null, applyCoupon, removeCoupon: () => setManualCampaignId(null)
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext)!;

/* Favorites */
export function useFavorites() {
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [restaurantIds, setRestaurantIds] = useState<string[]>([]);
  return {
    isDishFav: (id: string) => dishIds.includes(id),
    toggleDish: (id: string) => setDishIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
    isRestaurantFav: (id: string) => restaurantIds.includes(id),
    toggleRestaurant: (id: string) => setRestaurantIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]),
  };
}

/* App UI */
export function useAppUI() {
  const [location, setLocation] = useState("Current Location");
  const [secondaryLocation, setSecondaryLocation] = useState("");
  const [vegMode, setVegMode] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  return {
    location, secondaryLocation, setLocation: (l: string, coords?: any, sec?: string) => { setLocation(l); if(sec) setSecondaryLocation(sec); },
    detectLocation: async () => ({ ok: true, message: "Location detected" }),
    detectingLocation: false,
    locationPermission: "granted" as "granted" | "unsupported",
    vegMode, setVegMode,
    userCoords: { lat: 0, lng: 0 },
    recentSearches,
    pushRecent: (s: string) => setRecentSearches(p => [s, ...p.filter(x => x !== s)].slice(0, 5)),
    clearRecent: () => setRecentSearches([]),
  };
}

/* Orders */
export type OrderStatus = "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "ARRIVED" | "ASSIGNING" | "ASSIGNED" | "AT_PICKUP" | "REJECTED";
export type Order = {
  id: string;
  status: OrderStatus;
  items: CartItem[];
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  total: number;
  subtotal: number;
  delivery: number;
  taxes: number;
  discount: number;
  placedAt: number;
  addressLabel: string;
  addressLine: string;
  driver: { name: string; vehicle: string; rating: number; phone: string };
  etaMins: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  paymentLabel?: string;
  deliveryInstructions?: string;
  contactless?: boolean;
  notes?: string;
  couponCode?: string;
  driverId?: string;
  otp?: string;
  paymentStatus?: string;
};
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Order Placed", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready",
  PICKED_UP: "Picked Up", OUT_FOR_DELIVERY: "Out for Delivery", DELIVERED: "Delivered",
  CANCELLED: "Cancelled", ARRIVED: "Arrived", ASSIGNING: "Assigning", ASSIGNED: "Assigned", AT_PICKUP: "At Pickup", REJECTED: "Rejected"
};
export const STATUS_FLOW: OrderStatus[] = ["PLACED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

export function useOrders() {
  return {
    orders: [] as Order[],
    reorder: (id: string) => [] as CartItem[],
    cancelOrder: async (id: string) => ({ ok: true, message: "Cancelled" }),
    getOrder: (id: string) => null as Order | null,
    subscribeToOrders: (id?: string) => () => {},
    loading: false,
    placeOrder: async (data: any) => ({ ok: true, orderId: "123", message: "Order placed" })
  };
}


import { ScoobixExtrasProviders } from "./scoobix-extras";

/* Providers */
export function ScoobixProviders({ children }: { children: ReactNode }) {
  return (
    <CmsProvider>
      <CartProvider>
        <ScoobixExtrasProviders>
          {children}
        </ScoobixExtrasProviders>
      </CartProvider>
    </CmsProvider>
  );
}
