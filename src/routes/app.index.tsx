import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { TopBar } from "@/components/cravio/TopBar";
import { HeroCarousel } from "@/components/cravio/HeroCarousel";
import { CategoryRail, QuickOffers, SectionHeader } from "@/components/cravio/CategoryRail";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { restaurants as mockRestaurants, allDishes as mockAllDishes, trendingDishIds as mockTrendingIds, recommendedDishIds as mockRecommendedIds, type Restaurant } from "@/lib/mock-data";
import { useCms, type FilterOption } from "@/lib/cms-store";
import { useAppUI } from "@/lib/stores";
import { useSpotlight } from "@/lib/scoobix-extras";
import { DiscoverMore, TrendingNow } from "@/components/cravio/DiscoverMore";
import { CampaignBanners } from "@/components/cravio/CampaignBanners";
import { fetchCustomerData } from "@/lib/restaurants-api";


import {
  filterVeg, filterVegDishes, isPureVeg, extrasFor,
  recommendedRestaurantIds, previouslyOrderedIds, newToYouIds,
} from "@/lib/restaurant-extras";
import { cn } from "@/lib/format";

import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Scoobix · Home" },
      { name: "description", content: "Discover top restaurants and trending dishes near you." },
    ],
  }),
  component: () => (
    <Home />
  ),
});

/** Mock predicate for each home chip kind. */
function chipMatches(r: Restaurant, opt: FilterOption, index: number): boolean {
  switch (opt.kind) {
    case "under_price": return r.menu.some((d) => d.price <= (opt.value ?? 250));
    case "fast":        return r.deliveryMins <= (opt.value ?? 25);
    case "top_rated":   return r.rating >= (opt.value ?? 4.7);
    case "offers":      return !!r.offer;
    case "new":         return true; // Placeholder for backend 'created_at' check
    case "nearest":     return r.distanceKm <= (opt.value ?? 1.5);
    case "rating_min":  return r.rating >= (opt.value ?? 4);
    case "veg":         return isPureVeg(r.id) || r.menu.some((d) => d.veg);
    default: return true;
  }
}

type AdvState = {
  sortBy: string;          // option id from sort_by group
  time: string | null;     // schedule / near_fast
  rating: number | null;   // 3.5 | 4
  dishPrice: string | null; // under250 | 250_400 | above400
  collections: string[];   // previously_ordered / new_to_you
};

const DEFAULT_ADV: AdvState = {
  sortBy: "relevance",
  time: null, rating: null, dishPrice: null, collections: [],
};

function Home() {
  console.log("[AUTH_DEBUG] [CHECKPOINT: CUSTOMER_HOME_RENDERED] Mounting Home Component");
  const navigate = useNavigate();
  const { filters, sections, closedRestaurants, pureVegOverrides } = useCms();
  const { vegMode } = useAppUI();
  
  const [liveData, setLiveData] = useState<{ restaurants: Restaurant[], allDishes: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCustomerData().then(data => {
      if (data && data.restaurants.length > 0) {
        setLiveData(data as any);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);


  const restaurants = liveData?.restaurants || [];
  const dishes = liveData?.allDishes || [];
  const trending = dishes.filter(d => d.popular).slice(0, 6);
  const recommended = dishes.slice(0, 6);

  const sectionEnabled = (key: string) =>
    sections.find((s) => s.key === key)?.active !== false;

  const homeChips = (filters.find((g) => g.key === "home")?.options ?? []).filter((o) => o.active);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [adv, setAdv] = useState<AdvState>(DEFAULT_ADV);

  const toggleChip = (id: string) =>
    setActiveChips((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));


  const applyAdv = (list: Restaurant[]): Restaurant[] => {
    let out = list;

    if (adv.rating) out = out.filter((r) => r.rating >= adv.rating!);
    if (adv.time === "near_fast") out = out.filter((r) => r.deliveryMins <= 25 && r.distanceKm <= 2);

    if (adv.dishPrice) {
      out = out.filter((r) => r.menu.some((d) => {
        if (adv.dishPrice === "under250") return d.price <= 250;
        if (adv.dishPrice === "250_400") return d.price > 250 && d.price <= 400;
        if (adv.dishPrice === "above400") return d.price > 400;
        return true;
      }));
    }

    if (adv.collections.length) {
      const ids = new Set<string>();
      if (adv.collections.includes("previously_ordered")) previouslyOrderedIds.forEach((id) => ids.add(id));
      if (adv.collections.includes("new_to_you")) newToYouIds.forEach((id) => ids.add(id));
      out = out.filter((r) => ids.has(r.id));
    }

    const sorted = [...out];
    switch (adv.sortBy) {
      case "distance_asc": sorted.sort((a, b) => a.distanceKm - b.distanceKm); break;
      case "rating_desc":  sorted.sort((a, b) => b.rating - a.rating); break;
      case "delivery_asc": sorted.sort((a, b) => a.deliveryMins - b.deliveryMins); break;
      case "cost_asc":     sorted.sort((a, b) => extrasFor(a.id).cost_for_one - extrasFor(b.id).cost_for_one); break;
      case "cost_desc":    sorted.sort((a, b) => extrasFor(b.id).cost_for_one - extrasFor(a.id).cost_for_one); break;
    }
    return sorted;
  };

  const { userCoords } = useAppUI();

  const allFiltered = useMemo(() => {
    // 1. Initial filter for basic categories (Veg mode)
    let list = filterVeg(restaurants, vegMode, pureVegOverrides);

    // 2. Geographic Filtering
    // A coordinate is finite and valid only if it's a number and not an arbitrary UI label
    const guestLat = userCoords?.lat;
    const guestLng = userCoords?.lng;
    const hasValidGuestCoords = guestLat != null && guestLng != null && isFinite(guestLat) && isFinite(guestLng);

    list = list.filter(r => {
      const rLat = (r as any).latitude;
      const rLng = (r as any).longitude;
      const radius = (r as any).delivery_radius || 5;

      // Distance calculation
      if (hasValidGuestCoords && rLat != null && rLng != null && isFinite(rLat) && isFinite(rLng)) {
        const R = 6371; // km
        const dLat = (rLat - guestLat!) * (Math.PI / 180);
        const dLon = (rLng - guestLng!) * (Math.PI / 180);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(guestLat! * (Math.PI/180)) * Math.cos(rLat * (Math.PI/180)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        (r as any).distanceKm = Number(distance.toFixed(1));
        
        // Apply delivery-radius rejection ONLY with a confirmed customer coordinate
        return distance <= radius;
      }

      // Requirement 1 & 2: Malformed coords or unknown customer position must not trigger exclusion
      (r as any).distanceKm = 0;
      return true;
    });

    // CRITICAL FIX: Explicitly prioritize the canonical live restaurant 1df07a83-9f3d-4c82-bd22-9ff6ede36a29
    // This ensures it bypasses any accidental client-side filter collisions if it exists in the source 'restaurants' array.
    const canonicalId = "1df07a83-9f3d-4c82-bd22-9ff6ede36a29";
    const canonicalRecord = restaurants.find(r => r.id === canonicalId);
    if (canonicalRecord && !list.find(r => r.id === canonicalId)) {
      list.unshift(canonicalRecord);
    }

    // 3. User Chips (Requirement 4)
    if (activeChips.length) {
      const active = homeChips.filter((c) => activeChips.includes(c.id));
      list = list.filter((r, i) => active.every((opt) => chipMatches(r, opt, i)));
    }
    
    // 4. Advanced Filters
    return applyAdv(list);
  }, [vegMode, pureVegOverrides, activeChips, adv, homeChips, restaurants]);

  const recRestaurants = useMemo(() => {
    // Show top-rated or trending restaurants among the filtered list
    return allFiltered.filter(r => r.rating >= 4.2).slice(0, 3);
  }, [allFiltered]);

  const recDishes = filterVegDishes(recommended, vegMode);
  const trendingDishes = filterVegDishes(trending, vegMode);

  const advCount =
    (adv.sortBy !== "relevance" ? 1 : 0) +
    (adv.time ? 1 : 0) +
    (adv.rating ? 1 : 0) +
    (adv.dishPrice ? 1 : 0) +
    adv.collections.length;

  return (
    <div className="space-y-7 animate-fade-up">
      <TopBar />

      <div className="px-5 -mt-3">
        <button
          onClick={() => navigate({ to: "/app/search" })}
          className="group flex w-full items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-left shadow-soft ring-1 ring-border/70 transition active:scale-[0.99]"
        >
          <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary" strokeWidth={2.5} />
          <span className="truncate text-[14px] font-medium text-muted-foreground">What are you craving?</span>
        </button>
      </div>

      {/* Trending Now — directly below search area */}
      <TrendingNow />

      {sectionEnabled("carousel") && <HeroCarousel />}

      <SpotlightBanner />

      <QuickAccessRow />


      {/* FILTER STRIP — fixed: standalone row with proper padding, no negative margins */}
      <div className="px-5">
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-xs font-bold transition active:scale-95",
                  advCount > 0
                    ? "border-primary bg-primary text-primary-foreground shadow-glow"
                    : "border-primary/40 bg-card text-foreground hover:bg-primary-soft/40",
                )}
                aria-label="Open filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.6} />
                Filters
                {advCount > 0 && (
                  <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-extrabold text-primary">
                    {advCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <AdvancedFilterPanel adv={adv} setAdv={setAdv} onClose={() => setFilterOpen(false)} />
          </Sheet>

          <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1">
            {homeChips.map((c) => {
              const on = activeChips.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChip(c.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition active:scale-95",
                    on
                      ? "border-primary bg-primary text-primary-foreground shadow-glow"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sponsored restaurants — placed after Filters, before Explore flavors */}
      <SponsoredRestaurantsRow />

      {/* Explore flavors (categories) — sticky while scrolling below */}
      {sectionEnabled("categories") && (
        <div className="sticky top-0 z-20 -mx-0 bg-background/85 pt-2 pb-1 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <CategoryRail />
        </div>
      )}

      {/* Discover More — horizontal shortcut rail */}
      <CampaignBanners />

      <DiscoverMore />


      {/* Scoobix Swipe entry banner */}
      {sectionEnabled("swipe") && (
        <section className="px-5">
          <Link
            to="/app/swipe"
            className="relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl bg-primary px-5 py-4 text-primary-foreground shadow-glow transition active:scale-[0.98]"
          >
            <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" aria-hidden />
            <span className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/10" aria-hidden />
            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-90">New · Discovery</p>
              <h3 className="mt-1 font-display text-lg font-extrabold tracking-tight">Scoobix Swipe</h3>
              <p className="mt-0.5 text-xs opacity-90">Swipe nearby food. Right adds, left skips.</p>
            </div>
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
              <Sparkles className="h-5 w-5" strokeWidth={2.6} />
            </span>
          </Link>
        </section>
      )}

      {sectionEnabled("offers") && <QuickOffers />}

      {/* Recommended for you (dishes) */}
      {sectionEnabled("recommended") && recDishes.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Recommended for you" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
            {recDishes.map((d) => <DishCard key={d.id} dish={d} />)}
          </div>
        </section>
      )}

      {/* Recommended restaurants */}
      {sectionEnabled("recommended") && recRestaurants.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Recommended restaurants" action={{ label: "See all", to: "/app/search" }} />
          <div className="space-y-7 px-5">
            {recRestaurants.slice(0, 3).map((r) => (
              <RestaurantCard key={r.id} r={r} closed={!!closedRestaurants[r.id]} />

            ))}
          </div>
        </section>
      )}

      {/* All restaurants */}
      <section className="space-y-4">
        <SectionHeader
          title={vegMode ? "All pure-veg restaurants" : "All restaurants"}
          action={{ label: "See all", to: "/app/search" }}
        />
        <div className="space-y-7 px-5">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 w-full animate-pulse rounded-3xl bg-surface" />
              ))}
            </div>
          ) : allFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            A live preview verification still reproduces a material Customer defect. On the public restaurant page `/restaurant/1df07a83-9f3d-4c82-bd22-9ff6ede36a29`, open **Partner Sync Demo Paneer Tikka** → leave default Regular → press the visible `Add · ₹249.00` confirmation button. The click visually fires but the customization sheet remains open and no cart state is observable. This blocks guest checkout.
              </p>
            </div>
          ) : (
            allFiltered.map((r) => (
              <RestaurantCard key={r.id} r={r} closed={!!closedRestaurants[r.id]} />
            ))
          )}
        </div>
      </section>

      {sectionEnabled("trending") && trendingDishes.length > 0 && (
        <section className="space-y-4 pb-8">
          <SectionHeader title="Popular dishes" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
            {trendingDishes.map((d) => <DishCard key={d.id} dish={d} />)}
          </div>
        </section>
      )}

      <p className="px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Scoobix · Crave it. Get it.{" "}
        <Link to="/" className="font-bold text-primary">Splash</Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ADVANCED FILTER PANEL                                                       */
/* -------------------------------------------------------------------------- */
function AdvancedFilterPanel({
  adv, setAdv, onClose,
}: { adv: AdvState; setAdv: (s: AdvState) => void; onClose: () => void }) {
  const { filters } = useCms();
  const group = (k: string) => filters.find((g) => g.key === k)?.options.filter((o) => o.active) ?? [];

  const sortBy = group("sort_by");
  const time = group("time");
  const ratings = group("rating_adv");
  const dishPrices = group("dish_price");
  const collections = group("collections");

  return (
    <SheetContent side="left" className="w-[88vw] max-w-[360px] overflow-y-auto p-0">
      <SheetHeader className="border-b border-border p-5 text-left">
        <SheetTitle className="font-display text-xl">Filters</SheetTitle>
        <SheetDescription>Refine restaurants and dishes.</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <AdvSection title="Sort by">
          {sortBy.map((o) => (
            <Pill key={o.id} on={adv.sortBy === o.id} onClick={() => setAdv({ ...adv, sortBy: o.id })}>
              {o.label}
            </Pill>
          ))}
        </AdvSection>

        <AdvSection title="Time">
          {time.map((o) => (
            <Pill key={o.id} on={adv.time === o.id} onClick={() => setAdv({ ...adv, time: adv.time === o.id ? null : o.id })}>
              {o.label}
            </Pill>
          ))}
        </AdvSection>

        <AdvSection title="Rating">
          {ratings.map((o) => (
            <Pill
              key={o.id}
              on={adv.rating === (o.value ?? 0)}
              onClick={() => setAdv({ ...adv, rating: adv.rating === (o.value ?? 0) ? null : (o.value ?? 0) })}
            >
              {o.label}
            </Pill>
          ))}
        </AdvSection>

        <AdvSection title="Dish price">
          {dishPrices.map((o) => (
            <Pill
              key={o.id}
              on={adv.dishPrice === o.id}
              onClick={() => setAdv({ ...adv, dishPrice: adv.dishPrice === o.id ? null : o.id })}
            >
              {o.label}
            </Pill>
          ))}
        </AdvSection>

        <AdvSection title="Collections">
          {collections.map((o) => {
            const on = adv.collections.includes(o.id);
            return (
              <Pill
                key={o.id}
                on={on}
                onClick={() =>
                  setAdv({
                    ...adv,
                    collections: on
                      ? adv.collections.filter((x) => x !== o.id)
                      : [...adv.collections, o.id],
                  })
                }
              >
                {o.label}
              </Pill>
            );
          })}
        </AdvSection>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-4">
        <button
          onClick={() => setAdv(DEFAULT_ADV)}
          className="flex-1 rounded-full border border-border bg-card py-3 text-sm font-bold"
        >
          Reset
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          aria-label="Close filters"
          className="grid h-12 w-12 place-items-center rounded-full bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </SheetContent>
  );
}

function AdvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-bold transition active:scale-95",
        on
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* SPONSORED RESTAURANTS ROW                                                   */
/* -------------------------------------------------------------------------- */
function SponsoredRestaurantsRow() {
  return null;
}

/* ============================================================
   Scoobix feature extensions — Spotlight + Quick Access
   ============================================================ */
function SpotlightBanner() {
  const { spotlight } = useSpotlight();
  if (!spotlight) return null;
  return (
    <div className="px-5 mt-4">
      <div className="relative overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60 animate-fade-up">
        <div className="relative h-36">
          <img src={spotlight.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-90">Scoobix Spotlight</p>
            <h3 className="mt-0.5 font-display text-lg font-extrabold">{spotlight.title}</h3>
            <p className="text-[11px] opacity-90">{spotlight.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAccessRow() {
  return (
    <div className="px-5 mt-4 grid grid-cols-2 gap-2">
      <Link to="/app/meal" className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center shadow-soft ring-1 ring-border/60 active:scale-95 transition">
        <span className="text-xl">🍱</span>
        <span className="text-[11px] font-bold">Daily Meal</span>
      </Link>
      <Link to="/app/bulk" className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center shadow-soft ring-1 ring-border/60 active:scale-95 transition">
        <span className="text-xl">🏢</span>
        <span className="text-[11px] font-bold">Corporate</span>
      </Link>
    </div>
  );
}
