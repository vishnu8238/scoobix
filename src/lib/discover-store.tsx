/**
 * Discover More cards, Trending Now chips, and Restaurant collection requests.
 *
 * Live-fetches from InsForge (`discover_cards`, `trending_chips` tables).
 * Collection inclusion requests have no dedicated table, so they persist as a
 * JSON row in `app_settings` via the shared kv helpers. Falls back to
 * hard-coded defaults on first boot when a table is empty. No localStorage.
 */
import { useSyncExternalStore, useEffect } from "react";
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { kvGet, kvSet } from "./kv-store";


const uid = () => Math.random().toString(36).slice(2, 10);

function createStore<T>(initial: T) {
  let state: T = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

/* ---------- Discover More ---------- */
export type DiscoverCard = {
  id: string;
  title: string;
  icon: string;
  image?: string;
  color?: string;
  query: string;
  enabled: boolean;
  order: number;
  startsAt?: string;
  endsAt?: string;
};

const DEFAULT_DISCOVER: DiscoverCard[] = [
  { id: "d1",  title: "Offers",           icon: "🎁", color: "#ef4444", query: "offer",         enabled: true, order: 1 },
  { id: "d2",  title: "Local Legends",    icon: "🏆", color: "#f59e0b", query: "local",         enabled: true, order: 2 },
  { id: "d3",  title: "Women Owned",      icon: "💜", color: "#a855f7", query: "women owned",   enabled: true, order: 3 },
  { id: "d4",  title: "Healthy",          icon: "🥗", color: "#22c55e", query: "healthy",       enabled: true, order: 4 },
  { id: "d5",  title: "Pure Veg",         icon: "🌿", color: "#16a34a", query: "veg",           enabled: true, order: 5 },
  { id: "d6",  title: "Budget Meals",     icon: "💰", color: "#eab308", query: "budget",        enabled: true, order: 6 },
  { id: "d7",  title: "Family Packs",     icon: "👨‍👩‍👧", color: "#f97316", query: "family",  enabled: true, order: 7 },
  { id: "d8",  title: "New Restaurants",  icon: "✨", color: "#0ea5e9", query: "new",           enabled: true, order: 8 },
  { id: "d9",  title: "Trending",         icon: "🔥", color: "#dc2626", query: "trending",      enabled: true, order: 9 },
  { id: "d10", title: "Best Rated",       icon: "⭐", color: "#facc15", query: "best rated",    enabled: true, order: 10 },
  { id: "d11", title: "Breakfast",        icon: "🥞", color: "#fb923c", query: "breakfast",     enabled: true, order: 11 },
  { id: "d12", title: "Late Night",       icon: "🌙", color: "#6366f1", query: "late night",    enabled: true, order: 12 },
  { id: "d13", title: "Desserts",         icon: "🍰", color: "#ec4899", query: "dessert",       enabled: true, order: 13 },
  { id: "d14", title: "Street Food",      icon: "🌮", color: "#f97316", query: "street",        enabled: true, order: 14 },
  { id: "d15", title: "Premium Dining",   icon: "🥂", color: "#7c3aed", query: "premium",       enabled: true, order: 15 },
];

const discoverStore = createStore<DiscoverCard[]>(DEFAULT_DISCOVER);
let discoverHydrated = false;

async function hydrateDiscover() {
  if (discoverHydrated) return;
  discoverHydrated = true;
  const rows = await listTable<DiscoverCard>("discover_cards");
  if (rows.length) discoverStore.set(rows);
}

const isVisible = (c: { enabled: boolean; startsAt?: string; endsAt?: string }) => {
  if (!c.enabled) return false;
  const now = Date.now();
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
  if (c.endsAt   && new Date(c.endsAt).getTime()   < now) return false;
  return true;
};

export function useDiscoverCards() {
  useEffect(() => { void hydrateDiscover(); }, []);
  const all = useSyncExternalStore(discoverStore.subscribe, discoverStore.get, () => DEFAULT_DISCOVER);
  return [...all].sort((a, b) => a.order - b.order);
}
export function useVisibleDiscoverCards() {
  return useDiscoverCards().filter(isVisible);
}
export const discoverActions = {
  add: (input: Partial<DiscoverCard>) => {
    const card: DiscoverCard = { id: uid(), title: "New card", icon: "✨", query: "", enabled: true, order: (discoverStore.get().at(-1)?.order ?? 0) + 1, ...input };
    discoverStore.set((prev) => [...prev, card]);
    void createRecord("discover_cards", card as unknown as Record<string, unknown>);
  },
  update: (id: string, patch: Partial<DiscoverCard>) => {
    discoverStore.set((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    void patchRecord("discover_cards", id, patch as Record<string, unknown>);
  },
  remove: (id: string) => {
    discoverStore.set((prev) => prev.filter((c) => c.id !== id));
    void deleteRecord("discover_cards", id);
  },
  reorder: (id: string, dir: -1 | 1) => discoverStore.set((prev) => {
    const list = [...prev].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((c) => c.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return prev;
    const a = list[idx], b = list[swap];
    void patchRecord("discover_cards", a.id, { order: b.order });
    void patchRecord("discover_cards", b.id, { order: a.order });
    return prev.map((c) => c.id === a.id ? { ...c, order: b.order } : c.id === b.id ? { ...c, order: a.order } : c);
  }),
};

/* ---------- Trending Now ---------- */
export type TrendingChip = {
  id: string;
  name: string;
  image: string;
  enabled: boolean;
  order: number;
  startsAt?: string;
  endsAt?: string;
  auto?: boolean;
};

const DEFAULT_TRENDING: TrendingChip[] = [
  { id: "t1",  name: "Pizza",         image: "https://images.unsplash.com/photo-1548365328-9f547fb0953b?w=200",  enabled: true, order: 1 },
  { id: "t2",  name: "Burger",        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200",  enabled: true, order: 2 },
  { id: "t3",  name: "Biryani",       image: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=200",  enabled: true, order: 3 },
  { id: "t4",  name: "Chinese",       image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200",  enabled: true, order: 4 },
  { id: "t5",  name: "Rolls",         image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=200",  enabled: true, order: 5 },
  { id: "t6",  name: "Shawarma",      image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=200",  enabled: true, order: 6 },
  { id: "t7",  name: "South Indian",  image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=200",  enabled: true, order: 7 },
  { id: "t8",  name: "Ice Cream",     image: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=200",  enabled: true, order: 8 },
  { id: "t9",  name: "Cake",          image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200",  enabled: true, order: 9 },
  { id: "t10", name: "Healthy",       image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200",  enabled: true, order: 10 },
  { id: "t11", name: "Coffee",        image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",  enabled: true, order: 11 },
];

const trendingStore = createStore<TrendingChip[]>(DEFAULT_TRENDING);
let trendingHydrated = false;
async function hydrateTrending() {
  if (trendingHydrated) return;
  trendingHydrated = true;
  const rows = await listTable<TrendingChip>("trending_chips");
  if (rows.length) trendingStore.set(rows);
}

export function useTrendingChips() {
  useEffect(() => { void hydrateTrending(); }, []);
  const all = useSyncExternalStore(trendingStore.subscribe, trendingStore.get, () => DEFAULT_TRENDING);
  return [...all].sort((a, b) => a.order - b.order);
}
export function useVisibleTrendingChips() {
  return useTrendingChips().filter(isVisible);
}
export const trendingActions = {
  add: (input: Partial<TrendingChip>) => {
    const chip: TrendingChip = { id: uid(), name: "New", image: "", enabled: true, order: (trendingStore.get().at(-1)?.order ?? 0) + 1, ...input };
    trendingStore.set((prev) => [...prev, chip]);
    void createRecord("trending_chips", chip as unknown as Record<string, unknown>);
  },
  update: (id: string, patch: Partial<TrendingChip>) => {
    trendingStore.set((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    void patchRecord("trending_chips", id, patch as Record<string, unknown>);
  },
  remove: (id: string) => {
    trendingStore.set((prev) => prev.filter((c) => c.id !== id));
    void deleteRecord("trending_chips", id);
  },
  reorder: (id: string, dir: -1 | 1) => trendingStore.set((prev) => {
    const list = [...prev].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((c) => c.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return prev;
    const a = list[idx], b = list[swap];
    void patchRecord("trending_chips", a.id, { order: b.order });
    void patchRecord("trending_chips", b.id, { order: a.order });
    return prev.map((c) => c.id === a.id ? { ...c, order: b.order } : c.id === b.id ? { ...c, order: a.order } : c);
  }),
};

/* ---------- Restaurant collection inclusion requests ---------- */
export type CollectionRequest = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  collectionId: string;
  collectionTitle: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

const reqStore = createStore<CollectionRequest[]>([]);
let reqHydrated = false;
async function hydrateReqs() {
  if (reqHydrated) return;
  reqHydrated = true;
  const rows = await kvGet<CollectionRequest[]>("collection_requests");
  if (Array.isArray(rows) && rows.length) reqStore.set(rows);
}
function persistReqs() {
  void kvSet("collection_requests", reqStore.get());
}

export function useCollectionRequests() {
  useEffect(() => { void hydrateReqs(); }, []);
  return useSyncExternalStore(reqStore.subscribe, reqStore.get, () => [] as CollectionRequest[]);
}
export const collectionRequestActions = {
  submit: (input: Omit<CollectionRequest, "id" | "status" | "createdAt">) => {
    const rec: CollectionRequest = { ...input, id: uid(), status: "pending", createdAt: Date.now() };
    reqStore.set((prev) => [rec, ...prev]);
    persistReqs();
  },
  setStatus: (id: string, status: CollectionRequest["status"]) => {
    reqStore.set((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    persistReqs();
  },
  remove: (id: string) => {
    reqStore.set((prev) => prev.filter((r) => r.id !== id));
    persistReqs();
  },
};

