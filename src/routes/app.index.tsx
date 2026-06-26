import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/cravio/TopBar";
import { HeroCarousel } from "@/components/cravio/HeroCarousel";
import { CategoryRail, QuickOffers, SectionHeader } from "@/components/cravio/CategoryRail";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { restaurants, allDishes, trendingDishIds, recommendedDishIds, type Restaurant } from "@/lib/mock-data";
import { useCms, type FilterOption } from "@/lib/cms-store";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Cravio · Home" },
      { name: "description", content: "Discover top restaurants and trending dishes near you." },
    ],
  }),
  component: Home,
});

/** Mock predicate for each home chip kind. */
function chipMatches(r: Restaurant, opt: FilterOption, index: number): boolean {
  switch (opt.kind) {
    case "under_price":
      return r.menu.some((d) => d.price <= (opt.value ?? 250));
    case "fast":
      return r.deliveryMins <= (opt.value ?? 25);
    case "top_rated":
      return r.rating >= (opt.value ?? 4.7);
    case "offers":
      return !!r.offer;
    case "new":
      return index >= restaurants.length - 2; // last two are "new"
    case "nearest":
      return r.distanceKm <= (opt.value ?? 1.5);
    case "rating_min":
      return r.rating >= (opt.value ?? 4);
    case "veg":
      return r.menu.some((d) => d.veg);
    default:
      return true;
  }
}

function Home() {
  const navigate = useNavigate();
  const { filters, closedRestaurants } = useCms();
  const dishes = allDishes();
  const trending = trendingDishIds.map((id) => dishes.find((d) => d.id === id)!).filter(Boolean);
  const recommended = recommendedDishIds.map((id) => dishes.find((d) => d.id === id)!).filter(Boolean);

  const homeChips = (filters.find((g) => g.key === "home")?.options ?? []).filter((o) => o.active);
  const [activeChips, setActiveChips] = useState<string[]>([]);

  const toggleChip = (id: string) =>
    setActiveChips((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const filteredRestaurants = useMemo(() => {
    if (activeChips.length === 0) return restaurants;
    const active = homeChips.filter((c) => activeChips.includes(c.id));
    return restaurants.filter((r, i) => active.every((opt) => chipMatches(r, opt, i)));
  }, [activeChips, homeChips]);

  const featured = filteredRestaurants.slice(0, 2);
  const more = filteredRestaurants.slice(2, 4);
  const explore = filteredRestaurants.slice(4);

  return (
    <div className="space-y-8 animate-fade-up">
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

      <HeroCarousel />

      {homeChips.length > 0 && (
        <div className="no-scrollbar -my-2 flex gap-2 overflow-x-auto px-5">
          {homeChips.map((c) => {
            const on = activeChips.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleChip(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition active:scale-95",
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
      )}

      <CategoryRail />
      <QuickOffers />

      <section className="space-y-4">
        <SectionHeader title={activeChips.length ? "Matching for you" : "Chef's selection"} action={{ label: "See all", to: "/app/search" }} />
        <div className="space-y-7 px-5">
          {featured.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No restaurants match those filters.</p>
          ) : featured.map((r) => <RestaurantCard key={r.id} r={r} closed={!!closedRestaurants[r.id]} />)}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Recommended for you" />
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
          {recommended.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Top restaurants near you" action={{ label: "See all", to: "/app/search" }} />
        <div className="space-y-7 px-5">
          {more.map((r) => (
            <RestaurantCard key={r.id} r={r} closed={!!closedRestaurants[r.id]} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Popular dishes" />
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
          {trending.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      </section>

      <section className="space-y-4 pb-8">
        <SectionHeader title="More places to explore" action={{ label: "See all", to: "/app/search" }} />
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
          {explore.map((r) => <RestaurantCard key={r.id} r={r} variant="compact" closed={!!closedRestaurants[r.id]} />)}
        </div>
      </section>

      <p className="px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Cravio · Crave it. Get it.{" "}
        <Link to="/" className="font-bold text-primary">Splash</Link>
      </p>
    </div>
  );
}
