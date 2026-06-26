import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { TopBar } from "@/components/cravio/TopBar";
import { HeroCarousel } from "@/components/cravio/HeroCarousel";
import { CategoryRail, QuickOffers, SectionHeader } from "@/components/cravio/CategoryRail";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { restaurants, allDishes, trendingDishIds, recommendedDishIds } from "@/lib/mock-data";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Cravio · Home" },
      { name: "description", content: "Discover top restaurants and trending dishes near you." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const dishes = allDishes();
  const trending = trendingDishIds.map((id) => dishes.find((d) => d.id === id)!).filter(Boolean);
  const recommended = recommendedDishIds.map((id) => dishes.find((d) => d.id === id)!).filter(Boolean);

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

      <CategoryRail />
      <QuickOffers />

      <section className="space-y-4">
        <SectionHeader title="Chef's selection" action={{ label: "See all", to: "/app/search" }} />
        <div className="space-y-7 px-5">
          {restaurants.slice(0, 2).map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
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
          {restaurants.slice(2, 4).map((r) => (
            <RestaurantCard key={r.id} r={r} />
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
          {restaurants.slice(4).map((r) => <RestaurantCard key={r.id} r={r} variant="compact" />)}
        </div>
      </section>

      <p className="px-6 pb-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Cravio · Crave it. Get it.{" "}
        <Link to="/" className="font-bold text-primary">Splash</Link>
      </p>
    </div>
  );
}
