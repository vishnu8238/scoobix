import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { IMAGES, categories as seedCategories, offers as seedOffers, restaurants as seedRestaurants } from "./mock-data";

/* ============================================================
   CMS STORE — Admin-controlled content for the Customer App.
   Persists to localStorage. Pure frontend, ready for backend swap.
   ============================================================ */

export type Banner = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  code?: string;
  active: boolean;
  order: number;
};

export type CmsCategory = {
  id: string;
  name: string;
  emoji: string;
  image: string;
  order: number;
  active: boolean;
};

export type HomeSection =
  | "carousel" | "categories" | "swipe" | "featured" | "trending" | "offers" | "recommended" | "collections";

export type HomeSectionConfig = {
  key: HomeSection;
  label: string;
  description: string;
  active: boolean;
};

export type FilterGroupKey =
  | "cuisine" | "price" | "rating" | "delivery" | "home"
  | "sort_by" | "time" | "dish_price" | "collections" | "rating_adv";

/**
 * Home chip predicate keys. Chips on the customer home use these IDs to
 * select which restaurants to keep when toggled on.
 */
export type HomeFilterKind =
  | "under_price" | "fast" | "top_rated" | "offers" | "new" | "nearest" | "rating_min" | "veg";

export type FilterOption = {
  id: string;
  label: string;
  active: boolean;
  /** Used for "home" filter chips — controls how the predicate is interpreted. */
  kind?: HomeFilterKind;
  /** Numeric threshold for the predicate (e.g. price ≤ value, rating ≥ value). */
  value?: number;
  order?: number;
};

export type FilterGroup = { key: FilterGroupKey; label: string; options: FilterOption[] };

export type CmsCoupon = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  kind: "pct" | "flat" | "freeship";
  value: number; // % when pct, ₹ when flat, 0 for freeship
  minOrder: number;
  expiry: string; // YYYY-MM-DD
  active: boolean;
};

type CmsCtx = {
  banners: Banner[];
  addBanner: (b: Omit<Banner, "id" | "order">) => void;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  deleteBanner: (id: string) => void;
  moveBanner: (id: string, dir: -1 | 1) => void;

  categories: CmsCategory[];
  addCategory: (c: Omit<CmsCategory, "id" | "order">) => void;
  updateCategory: (id: string, patch: Partial<CmsCategory>) => void;
  deleteCategory: (id: string) => void;
  moveCategory: (id: string, dir: -1 | 1) => void;

  sections: HomeSectionConfig[];
  toggleSection: (key: HomeSection) => void;

  filters: FilterGroup[];
  toggleFilter: (group: FilterGroupKey, id: string) => void;
  addFilter: (group: FilterGroupKey, label: string) => void;
  deleteFilter: (group: FilterGroupKey, id: string) => void;

  coupons: CmsCoupon[];
  addCoupon: (c: Omit<CmsCoupon, "id">) => void;
  updateCoupon: (id: string, patch: Partial<CmsCoupon>) => void;
  deleteCoupon: (id: string) => void;

  commissions: Record<string, number>; // restaurantId -> %
  setCommission: (restaurantId: string, pct: number) => void;

  // Restaurant availability (admin/partner controlled)
  closedRestaurants: Record<string, boolean>;
  toggleRestaurantClosed: (restaurantId: string) => void;
  setRestaurantClosed: (restaurantId: string, closed: boolean) => void;
  acceptingOrders: Record<string, boolean>; // restaurantId -> accepting new orders (default true)
  setAcceptingOrders: (restaurantId: string, on: boolean) => void;
  dishAvailability: Record<string, boolean>; // dishId -> available (default true unless explicitly false)
  setDishAvailability: (dishId: string, available: boolean) => void;
  blockedUsers: Record<string, boolean>; // userId -> blocked
  setUserBlocked: (userId: string, blocked: boolean) => void;

  // Veg/non-veg overrides (admin/partner controlled)
  pureVegOverrides: Record<string, boolean>;
  setPureVeg: (restaurantId: string, pureVeg: boolean) => void;
  dishVegOverrides: Record<string, boolean>; // dishId -> isVeg
  setDishVeg: (dishId: string, isVeg: boolean) => void;

  // Featured / promoted flags (admin controlled, backend-ready)
  featuredRestaurants: Record<string, boolean>;
  toggleFeaturedRestaurant: (restaurantId: string) => void;
  featuredDishes: Record<string, boolean>;
  toggleFeaturedDish: (dishId: string) => void;

  // Platform settings (backend-ready)
  settings: PlatformSettings;
  updateSettings: (patch: Partial<PlatformSettings>) => void;

  resetAll: () => void;
};

export type DeliverySlab = { uptoKm: number; fee: number };

export type PlatformSettings = {
  deliveryFee: number;
  taxPct: number;
  minOrder: number;
  supportPhone: string;
  supportEmail: string;
  /** Cart subtotal at/above which delivery is free (Scoobix free-delivery rule). */
  freeDeliveryMin: number;
  /** Distance-based delivery slabs. First matching slab (by uptoKm ascending) wins. */
  deliverySlabs: DeliverySlab[];
  /** Platform commission on driver earnings (percent). */
  driverCommissionPct: number;
  /** Enable Petpooja POS sync stubs across partner screens. */
  posEnabled: boolean;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  deliveryFee: 30,
  taxPct: 5,
  minOrder: 99,
  supportPhone: "+91 80000 12345",
  supportEmail: "support@cravio.app",
  freeDeliveryMin: 25,
  deliverySlabs: [
    { uptoKm: 2, fee: 25 },
    { uptoKm: 5, fee: 40 },
    { uptoKm: 10, fee: 65 },
    { uptoKm: 999, fee: 90 },
  ],
  driverCommissionPct: 15,
  posEnabled: false,
};


const CmsContext = createContext<CmsCtx | null>(null);
const KEY = "cravio_cms_v2";

const seedBanners = (): Banner[] =>
  seedOffers.map((o, i) => ({
    id: o.id,
    image: i === 0 ? IMAGES.burger : i === 1 ? IMAGES.biryani : IMAGES.sushi,
    title: o.title,
    subtitle: o.subtitle,
    cta: o.cta,
    code: o.code,
    active: true,
    order: i,
  }));

const seedCats = (): CmsCategory[] =>
  seedCategories.map((c, i) => ({ ...c, order: i, active: true }));

const seedSections = (): HomeSectionConfig[] => [
  { key: "carousel", label: "Hero carousel", description: "Top banner slideshow", active: true },
  { key: "categories", label: "Category rail", description: "Browse by cuisine type (Explore flavors)", active: true },
  { key: "swipe", label: "Scoobix Swipe", description: "Tinder-style food discovery entry banner", active: true },
  { key: "featured", label: "Featured restaurants", description: "Editor-picked spots", active: true },
  { key: "trending", label: "Trending dishes", description: "Most ordered this week", active: true },
  { key: "offers", label: "Offers strip", description: "Quick-tap promo cards", active: true },
  { key: "recommended", label: "Recommended for you", description: "Personalised picks", active: true },
  { key: "collections", label: "Collections", description: "Previously ordered & New to you", active: true },
];

const seedFilters = (): FilterGroup[] => [
  {
    key: "cuisine",
    label: "Cuisine",
    options: ["Italian", "Indian", "Japanese", "Mexican", "American", "BBQ", "Healthy", "Desserts"].map((l) => ({ id: l.toLowerCase(), label: l, active: true })),
  },
  {
    key: "price",
    label: "Price",
    options: [
      { id: "p1", label: "₹", active: true },
      { id: "p2", label: "₹₹", active: true },
      { id: "p3", label: "₹₹₹", active: true },
    ],
  },
  {
    key: "rating",
    label: "Rating",
    options: [
      { id: "r45", label: "4.5+", active: true },
      { id: "r40", label: "4.0+", active: true },
      { id: "r35", label: "3.5+", active: false },
    ],
  },
  {
    key: "delivery",
    label: "Delivery time",
    options: [
      { id: "d20", label: "Under 20 min", active: true },
      { id: "d30", label: "Under 30 min", active: true },
      { id: "d45", label: "Under 45 min", active: true },
    ],
  },
  {
    key: "sort_by",
    label: "Sort by",
    options: [
      { id: "relevance", label: "Relevance", active: true },
      { id: "distance_asc", label: "Distance low to high", active: true },
      { id: "rating_desc", label: "Rating high to low", active: true },
      { id: "delivery_asc", label: "Delivery time low to high", active: true },
      { id: "cost_asc", label: "Cost for one low to high", active: true },
      { id: "cost_desc", label: "Cost for one high to low", active: true },
    ],
  },
  {
    key: "time",
    label: "Time",
    options: [
      { id: "schedule",   label: "Schedule", active: true },
      { id: "near_fast",  label: "Near & Fast", active: true },
    ],
  },
  {
    key: "rating_adv",
    label: "Rating",
    options: [
      { id: "r35", label: "Rated 3.5+", active: true, value: 3.5 },
      { id: "r40", label: "Rated 4+",   active: true, value: 4 },
    ],
  },
  {
    key: "dish_price",
    label: "Dish price",
    options: [
      { id: "under250", label: "Under ₹250", active: true },
      { id: "250_400",  label: "₹250-₹400",   active: true },
      { id: "above400", label: "Above ₹400",  active: true },
    ],
  },
  {
    key: "collections",
    label: "Collections",
    options: [
      { id: "previously_ordered", label: "Previously ordered", active: true },
      { id: "new_to_you",         label: "New to you",         active: true },
    ],
  },
];

const seedCoupons = (): CmsCoupon[] => [
  { id: "c1", code: "SCOOBIX50", title: "50% off first 3 orders", subtitle: "New customers only", kind: "pct", value: 50, minOrder: 400, expiry: "2026-12-31", active: true },
  { id: "c2", code: "FREESHIP", title: "Free delivery weekend", subtitle: "On orders ₹500+", kind: "freeship", value: 0, minOrder: 500, expiry: "2026-09-30", active: true },
  { id: "c3", code: "NIGHT20", title: "20% off late night", subtitle: "10pm–2am", kind: "pct", value: 20, minOrder: 300, expiry: "2026-08-15", active: true },
  { id: "c4", code: "FLAT100", title: "₹100 off", subtitle: "Above ₹700", kind: "flat", value: 100, minOrder: 700, expiry: "2026-07-20", active: false },
];

type Snapshot = {
  banners: Banner[];
  categories: CmsCategory[];
  sections: HomeSectionConfig[];
  filters: FilterGroup[];
  coupons: CmsCoupon[];
  commissions: Record<string, number>;
  closedRestaurants: Record<string, boolean>;
  acceptingOrders: Record<string, boolean>;
  dishAvailability: Record<string, boolean>;
  blockedUsers: Record<string, boolean>;
  pureVegOverrides: Record<string, boolean>;
  dishVegOverrides: Record<string, boolean>;
  featuredRestaurants: Record<string, boolean>;
  featuredDishes: Record<string, boolean>;
  settings: PlatformSettings;
};

const seedCommissions = (): Record<string, number> => {
  const out: Record<string, number> = {};
  seedRestaurants.forEach((r, i) => { out[r.id] = [15, 18, 20, 15, 17, 22, 16, 19][i % 8]; });
  return out;
};

const seedHomeChips = (): FilterGroup => ({
  key: "home",
  label: "Home chips",
  options: [
    { id: "under250", label: "Under ₹250", active: true, kind: "under_price", value: 250 },
    { id: "fast",     label: "Fast delivery", active: true, kind: "fast", value: 25 },
    { id: "top",      label: "Top rated", active: true, kind: "top_rated", value: 4.7 },
    { id: "offers",   label: "Offers", active: true, kind: "offers" },
    { id: "new",      label: "New restaurants", active: true, kind: "new" },
    { id: "nearest",  label: "Nearest", active: true, kind: "nearest", value: 1.5 },
    { id: "rating4",  label: "Rating 4+", active: true, kind: "rating_min", value: 4 },
    { id: "veg",      label: "Veg options", active: true, kind: "veg" },
  ],
});

const seedFeaturedRestaurants = (): Record<string, boolean> => ({
  "trattoria-verde": true, "sakura-sushi": true, "char-and-crust": true,
});
const seedFeaturedDishes = (): Record<string, boolean> => ({
  "t1": true, "i1": true, "c1": true,
});

function defaultSnapshot(): Snapshot {
  return {
    banners: seedBanners(),
    categories: seedCats(),
    sections: seedSections(),
    filters: [...seedFilters(), seedHomeChips()],
    coupons: seedCoupons(),
    commissions: seedCommissions(),
    closedRestaurants: {},
    acceptingOrders: {},
    dishAvailability: {},
    blockedUsers: {},
    pureVegOverrides: {},
    dishVegOverrides: {},
    featuredRestaurants: seedFeaturedRestaurants(),
    featuredDishes: seedFeaturedDishes(),
    settings: DEFAULT_SETTINGS,
  };
}

function load(): Snapshot {
  if (typeof window === "undefined") return defaultSnapshot();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSnapshot();
    return { ...defaultSnapshot(), ...JSON.parse(raw) };
  } catch {
    return defaultSnapshot();
  }
}

const uid = () => Math.random().toString(36).slice(2, 9);
const reorder = <T extends { order: number }>(arr: T[]) =>
  [...arr].sort((a, b) => a.order - b.order).map((x, i) => ({ ...x, order: i }));

export function CmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snapshot>(() => load());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  // Hydrate coupons from InsForge on mount (backend wins when non-empty).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { listTable } = await import("./insforge-crud");
      const rows = await listTable<CmsCoupon>("coupons");
      if (!cancelled && rows.length) setState((s) => ({ ...s, coupons: rows }));
    })();
    return () => { cancelled = true; };
  }, []);

  const ctx: CmsCtx = {
    banners: reorder(state.banners),
    addBanner: (b) =>
      setState((s) => ({ ...s, banners: [...s.banners, { ...b, id: uid(), order: s.banners.length }] })),
    updateBanner: (id, patch) =>
      setState((s) => ({ ...s, banners: s.banners.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    deleteBanner: (id) =>
      setState((s) => ({ ...s, banners: reorder(s.banners.filter((x) => x.id !== id)) })),
    moveBanner: (id, dir) =>
      setState((s) => {
        const arr = reorder(s.banners);
        const i = arr.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return s;
        [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
        return { ...s, banners: arr };
      }),

    categories: reorder(state.categories),
    addCategory: (c) =>
      setState((s) => ({ ...s, categories: [...s.categories, { ...c, id: uid(), order: s.categories.length }] })),
    updateCategory: (id, patch) =>
      setState((s) => ({ ...s, categories: s.categories.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    deleteCategory: (id) =>
      setState((s) => ({ ...s, categories: reorder(s.categories.filter((x) => x.id !== id)) })),
    moveCategory: (id, dir) =>
      setState((s) => {
        const arr = reorder(s.categories);
        const i = arr.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return s;
        [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
        return { ...s, categories: arr };
      }),

    sections: state.sections,
    toggleSection: (key) =>
      setState((s) => ({ ...s, sections: s.sections.map((x) => (x.key === key ? { ...x, active: !x.active } : x)) })),

    filters: state.filters,
    toggleFilter: (group, id) =>
      setState((s) => ({
        ...s,
        filters: s.filters.map((g) =>
          g.key === group ? { ...g, options: g.options.map((o) => (o.id === id ? { ...o, active: !o.active } : o)) } : g,
        ),
      })),
    addFilter: (group, label) =>
      setState((s) => ({
        ...s,
        filters: s.filters.map((g) =>
          g.key === group ? { ...g, options: [...g.options, { id: uid(), label, active: true }] } : g,
        ),
      })),
    deleteFilter: (group, id) =>
      setState((s) => ({
        ...s,
        filters: s.filters.map((g) =>
          g.key === group ? { ...g, options: g.options.filter((o) => o.id !== id) } : g,
        ),
      })),

    coupons: state.coupons,
    addCoupon: (c) => {
      const created = { ...c, id: uid() };
      setState((s) => ({ ...s, coupons: [...s.coupons, created] }));
      void import("./insforge-crud").then(({ createRecord }) => createRecord("coupons", created as unknown as Record<string, unknown>));
    },
    updateCoupon: (id, patch) => {
      setState((s) => ({ ...s, coupons: s.coupons.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      void import("./insforge-crud").then(({ patchRecord }) => patchRecord("coupons", id, patch as Record<string, unknown>));
    },
    deleteCoupon: (id) => {
      setState((s) => ({ ...s, coupons: s.coupons.filter((x) => x.id !== id) }));
      void import("./insforge-crud").then(({ deleteRecord }) => deleteRecord("coupons", id));
    },

    commissions: state.commissions,
    setCommission: (restaurantId, pct) => {
      const clamped = Math.max(0, Math.min(100, pct));
      setState((s) => ({ ...s, commissions: { ...s.commissions, [restaurantId]: clamped } }));
      // Mirror to backend so the order-finalizer reads the same value.
      void import("./insforge").then(({ setRestaurantCommission }) => setRestaurantCommission(restaurantId, clamped));
    },

    closedRestaurants: state.closedRestaurants,
    toggleRestaurantClosed: (restaurantId) =>
      setState((s) => ({ ...s, closedRestaurants: { ...s.closedRestaurants, [restaurantId]: !s.closedRestaurants[restaurantId] } })),
    setRestaurantClosed: (restaurantId, closed) =>
      setState((s) => ({ ...s, closedRestaurants: { ...s.closedRestaurants, [restaurantId]: closed } })),

    acceptingOrders: state.acceptingOrders,
    setAcceptingOrders: (restaurantId, on) =>
      setState((s) => ({ ...s, acceptingOrders: { ...s.acceptingOrders, [restaurantId]: on } })),

    dishAvailability: state.dishAvailability,
    setDishAvailability: (dishId, available) =>
      setState((s) => ({ ...s, dishAvailability: { ...s.dishAvailability, [dishId]: available } })),

    blockedUsers: state.blockedUsers,
    setUserBlocked: (userId, blocked) =>
      setState((s) => ({ ...s, blockedUsers: { ...s.blockedUsers, [userId]: blocked } })),

    pureVegOverrides: state.pureVegOverrides,
    setPureVeg: (restaurantId, pureVeg) =>
      setState((s) => ({ ...s, pureVegOverrides: { ...s.pureVegOverrides, [restaurantId]: pureVeg } })),
    dishVegOverrides: state.dishVegOverrides,
    setDishVeg: (dishId, isVeg) =>
      setState((s) => ({ ...s, dishVegOverrides: { ...s.dishVegOverrides, [dishId]: isVeg } })),

    featuredRestaurants: state.featuredRestaurants,
    toggleFeaturedRestaurant: (id) =>
      setState((s) => ({ ...s, featuredRestaurants: { ...s.featuredRestaurants, [id]: !s.featuredRestaurants[id] } })),
    featuredDishes: state.featuredDishes,
    toggleFeaturedDish: (id) =>
      setState((s) => ({ ...s, featuredDishes: { ...s.featuredDishes, [id]: !s.featuredDishes[id] } })),


    settings: state.settings,
    updateSettings: (patch) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      // Mirror the corresponding fields into the platform-wide app_settings row.
      void import("./app-settings").then(({ patchAppSettings }) => {
        const mapped: Record<string, unknown> = {};
        if (patch.deliveryFee !== undefined) mapped.delivery_base_fee = patch.deliveryFee;
        if (patch.freeDeliveryMin !== undefined) mapped.free_delivery_min = patch.freeDeliveryMin;
        if (patch.deliverySlabs !== undefined) mapped.delivery_slabs = patch.deliverySlabs;
        if (patch.driverCommissionPct !== undefined) mapped.default_commission_pct = patch.driverCommissionPct;
        if (Object.keys(mapped).length) void patchAppSettings(mapped);
      });
    },

    resetAll: () => setState(defaultSnapshot()),
  };

  return <CmsContext.Provider value={ctx}>{children}</CmsContext.Provider>;
}

export const useCms = () => {
  const c = useContext(CmsContext);
  if (!c) throw new Error("useCms must be used within CmsProvider");
  return c;
};

export const CMS_IMAGE_OPTIONS: { key: keyof typeof IMAGES; src: string }[] = (
  Object.keys(IMAGES) as (keyof typeof IMAGES)[]
).map((k) => ({ key: k, src: IMAGES[k] }));
