import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { restaurants, allDishes, type Restaurant, type Dish } from "./mock-data";

/* ============================================================
   ADS STORE — Restaurant advertising (MVP, mock).
   Schema mirrors future InsForge backend table `restaurant_ads`.
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
const KEY = "cravio_ads_v1";

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function seedAds(): RestaurantAd[] {
  return [
    {
      id: "ad_seed1",
      restaurant_id: "trattoria-verde",
      campaign_name: "Weekend Pizza Push",
      budget: 1000, cpc_bid: 12,
      start_date: today(), end_date: inDays(14),
      target_radius: 5, target_areas: ["Indiranagar", "Koramangala"],
      category: "pizza",
      status: "active",
      clicks: 142, impressions: 4820, spend: 1704,
      created_at: today(),
    },
    {
      id: "ad_seed2",
      restaurant_id: "sakura-sushi",
      campaign_name: "Sushi Night Deals",
      budget: 800, cpc_bid: 9,
      start_date: today(), end_date: inDays(7),
      target_radius: 3, target_areas: ["HSR Layout"],
      category: "sushi",
      status: "active",
      clicks: 89, impressions: 2310, spend: 801,
      created_at: today(),
    },
    {
      id: "ad_seed3",
      restaurant_id: "char-and-crust",
      campaign_name: "Burger Boost",
      budget: 1500, cpc_bid: 15,
      start_date: today(), end_date: inDays(30),
      target_radius: 7, target_areas: ["Whitefield"],
      category: "burgers",
      status: "pending",
      clicks: 0, impressions: 0, spend: 0,
      created_at: today(),
    },
  ];
}

function load(): RestaurantAd[] {
  if (typeof window === "undefined") return seedAds();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedAds();
    return JSON.parse(raw) as RestaurantAd[];
  } catch {
    return seedAds();
  }
}

/** Mock auction ranking: bid + rating boost − distance penalty + relevance noise. */
function score(ad: RestaurantAd, r: Restaurant): number {
  const bid = ad.cpc_bid;
  const ratingBoost = (r.rating - 4) * 8;
  const distancePenalty = r.distanceKm * 1.5;
  const relevance = 2; // mock
  return bid + ratingBoost - distancePenalty + relevance;
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<RestaurantAd[]>(() => load());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(KEY, JSON.stringify(ads)); } catch { /* ignore */ }
  }, [ads]);

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
      return ad;
    },
    updateAd: (id, patch) =>
      setAds((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    deleteAd: (id) => setAds((p) => p.filter((x) => x.id !== id)),
    setStatus: (id, status) =>
      setAds((p) => p.map((x) => (x.id === id ? { ...x, status } : x))),
    trackClick: (id) =>
      setAds((p) => p.map((x) => (x.id === id ? { ...x, clicks: x.clicks + 1, spend: Math.min(x.budget, x.spend + x.cpc_bid) } : x))),
    trackImpression: (id) =>
      setAds((p) => p.map((x) => (x.id === id ? { ...x, impressions: x.impressions + 1 } : x))),

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
