import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { restaurants, allDishes, type Restaurant, type Dish } from "./mock-data";

/* ============================================================
   ADS STORE — Restaurant advertising.
   Backed entirely by the InsForge `restaurant_ads` table.
   ============================================================ */

export type AdStatus = "pending" | "active" | "paused" | "rejected" | "ended";

export type RestaurantAd = {
  id: string;
  restaurant_id: string;
  campaign_name: string;
  budget: number;        // daily budget ₹
  cpc_bid: number;       // ₹ per click
  start_date: string;    // YYYY-MM-DD
  end_date: string;      // YYYY-MM-DD
  target_radius: number; // km
  target_areas: string[];
  category: string;      // food category id
  status: AdStatus;
  clicks: number;
  impressions: number;
  spend: number;         // ₹ spent so far (today)
  created_at: string;
};

type AdsCtx = {
  ads: RestaurantAd[];
  createAd: (a: Omit<RestaurantAd, "id" | "status" | "clicks" | "impressions" | "spend" | "created_at"> & { status?: AdStatus }) => RestaurantAd;
  updateAd: (id: string, patch: Partial<RestaurantAd>) => void;
  deleteAd: (id: string) => void;
  setStatus: (id: string, status: AdStatus) => void;
  trackClick: (id: string) => void;
  trackImpression: (id: string) => void;
  /** Restaurants currently sponsored (active campaign), ranked by mock auction score. */
  sponsoredRestaurants: () => { restaurant: Restaurant; ad: RestaurantAd; score: number }[];
  /** Dishes currently sponsored (from sponsored restaurants), ranked similarly. */
  sponsoredDishes: () => { dish: Dish; ad: RestaurantAd; score: number }[];
  /** Lookup: is this restaurant being shown as sponsored right now? */
  isSponsored: (restaurantId: string) => boolean;
};

const AdsContext = createContext<AdsCtx | null>(null);

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);


/** Mock auction ranking: bid + rating boost − distance penalty + relevance noise. */
function score(ad: RestaurantAd, r: Restaurant): number {
  const bid = ad.cpc_bid;
  const ratingBoost = (r.rating - 4) * 8;
  const distancePenalty = r.distanceKm * 1.5;
  const relevance = 2; // mock
  return bid + ratingBoost - distancePenalty + relevance;
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<RestaurantAd[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { listTable } = await import("./insforge-crud");
      const rows = await listTable<RestaurantAd>("restaurant_ads");
      if (!cancelled) setAds(rows);
    })();
    return () => { cancelled = true; };
  }, []);

  const ctx: AdsCtx = {
    ads,
    createAd: (a) => {
      const ad: RestaurantAd = {
        id: uid(),
        clicks: 0, impressions: 0, spend: 0,
        status: a.status ?? "pending",
        created_at: today(),
        ...a,
      };
      setAds((prev) => [ad, ...prev]);
      void import("./insforge-crud").then(({ createRecord }) => createRecord("restaurant_ads", ad as unknown as Record<string, unknown>));
      return ad;
    },
    updateAd: (id, patch) => {
      setAds((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      void import("./insforge-crud").then(({ patchRecord }) => patchRecord("restaurant_ads", id, patch as Record<string, unknown>));
    },
    deleteAd: (id) => {
      setAds((p) => p.filter((x) => x.id !== id));
      void import("./insforge-crud").then(({ deleteRecord }) => deleteRecord("restaurant_ads", id));
    },
    setStatus: (id, status) => {
      setAds((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
      void import("./insforge-crud").then(({ patchRecord }) => patchRecord("restaurant_ads", id, { status }));
    },
    trackClick: (id) => {
      const cur = ads.find((x) => x.id === id);
      if (!cur) return;
      const next = { clicks: cur.clicks + 1, spend: Math.min(cur.budget, cur.spend + cur.cpc_bid) };
      setAds((p) => p.map((x) => (x.id === id ? { ...x, ...next } : x)));
      void import("./insforge-crud").then(({ patchRecord }) => patchRecord("restaurant_ads", id, next));
    },
    trackImpression: (id) => {
      const cur = ads.find((x) => x.id === id);
      if (!cur) return;
      const next = { impressions: cur.impressions + 1 };
      setAds((p) => p.map((x) => (x.id === id ? { ...x, ...next } : x)));
      void import("./insforge-crud").then(({ patchRecord }) => patchRecord("restaurant_ads", id, next));
    },

    sponsoredRestaurants: () => {
      const active = ads.filter((a) => a.status === "active" && a.spend < a.budget);
      const out = active
        .map((ad) => {
          const r = restaurants.find((x) => x.id === ad.restaurant_id);
          if (!r) return null;
          return { restaurant: r, ad, score: score(ad, r) };
        })
        .filter(Boolean) as { restaurant: Restaurant; ad: RestaurantAd; score: number }[];
      return out.sort((a, b) => b.score - a.score);
    },

    sponsoredDishes: () => {
      const active = ads.filter((a) => a.status === "active" && a.spend < a.budget);
      const dishes = allDishes();
      const out: { dish: Dish; ad: RestaurantAd; score: number }[] = [];
      active.forEach((ad) => {
        const r = restaurants.find((x) => x.id === ad.restaurant_id);
        if (!r) return;
        // pick the top-rated/popular dish for that restaurant
        const rDishes = dishes.filter((d) => r.menu.some((m) => m.id === d.id));
        const top = [...rDishes].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.rating - a.rating)[0];
        if (top) out.push({ dish: top, ad, score: score(ad, r) });
      });
      return out.sort((a, b) => b.score - a.score);
    },

    isSponsored: (restaurantId) =>
      ads.some((a) => a.status === "active" && a.spend < a.budget && a.restaurant_id === restaurantId),
  };

  return <AdsContext.Provider value={ctx}>{children}</AdsContext.Provider>;
}

export const useAds = () => {
  const c = useContext(AdsContext);
  if (!c) throw new Error("useAds must be used within AdsProvider");
  return c;
};
