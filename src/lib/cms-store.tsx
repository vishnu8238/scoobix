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

export type HomeSection = "carousel" | "categories" | "featured" | "trending" | "offers" | "recommended";

export type HomeSectionConfig = {
  key: HomeSection;
  label: string;
  description: string;
  active: boolean;
};

export type FilterGroupKey = "cuisine" | "price" | "rating" | "delivery";

export type FilterOption = { id: string; label: string; active: boolean };

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

  resetAll: () => void;
};

const CmsContext = createContext<CmsCtx | null>(null);
const KEY = "cravio_cms_v1";

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
  { key: "categories", label: "Category rail", description: "Browse by cuisine type", active: true },
  { key: "featured", label: "Featured restaurants", description: "Editor-picked spots", active: true },
  { key: "trending", label: "Trending dishes", description: "Most ordered this week", active: true },
  { key: "offers", label: "Offers strip", description: "Quick-tap promo cards", active: true },
  { key: "recommended", label: "Recommended for you", description: "Personalised picks", active: true },
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
];

const seedCoupons = (): CmsCoupon[] => [
  { id: "c1", code: "CRAVIO50", title: "50% off first 3 orders", subtitle: "New customers only", kind: "pct", value: 50, minOrder: 400, expiry: "2026-12-31", active: true },
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
};

const seedCommissions = (): Record<string, number> => {
  const out: Record<string, number> = {};
  seedRestaurants.forEach((r, i) => { out[r.id] = [15, 18, 20, 15, 17, 22, 16, 19][i % 8]; });
  return out;
};

function defaultSnapshot(): Snapshot {
  return {
    banners: seedBanners(),
    categories: seedCats(),
    sections: seedSections(),
    filters: seedFilters(),
    coupons: seedCoupons(),
    commissions: seedCommissions(),
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
    addCoupon: (c) => setState((s) => ({ ...s, coupons: [...s.coupons, { ...c, id: uid() }] })),
    updateCoupon: (id, patch) =>
      setState((s) => ({ ...s, coupons: s.coupons.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    deleteCoupon: (id) => setState((s) => ({ ...s, coupons: s.coupons.filter((x) => x.id !== id) })),

    commissions: state.commissions,
    setCommission: (restaurantId, pct) =>
      setState((s) => ({ ...s, commissions: { ...s.commissions, [restaurantId]: Math.max(0, Math.min(100, pct)) } })),

    resetAll: () => setState(defaultSnapshot()),
  };
    deleteCoupon: (id) => setState((s) => ({ ...s, coupons: s.coupons.filter((x) => x.id !== id) })),

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
