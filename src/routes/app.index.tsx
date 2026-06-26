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
    <div className="space-y-6">
      <TopBar />

      <div className="px-4 -mt-2 animate-fade-up">
        <button
          onClick={() => navigate({ to: "/app/search" })}
          className="flex w-full items-center gap-3 rounded-full bg-secondary px-4 py-3.5 text-left shadow-soft ring-1 ring-border/60 transition hover:bg-muted"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="truncate text-sm text-muted-foreground">Search restaurants, dishes and cuisines</span>
        </button>
      </div>

      <HeroCarousel />

      <CategoryRail />
      <QuickOffers />

      <section className="space-y-3">
        <SectionHeader title="Top restaurants near you" action={{ label: "See all", to: "/app/search" }} />
        <div className="space-y-3.5 px-4">
          {restaurants.slice(0, 4).map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Recommended for you" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
          {recommended.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Popular dishes" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
          {trending.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      </section>

      <section className="space-y-3 pb-6">
        <SectionHeader title="More places to explore" action={{ label: "See all", to: "/app/search" }} />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
          {restaurants.slice(4).map((r) => <RestaurantCard key={r.id} r={r} variant="compact" />)}
        </div>
      </section>

      <p className="px-6 pb-4 text-center text-[11px] text-muted-foreground">
        Cravio · Crave it. Get it.{" "}
        <Link to="/" className="font-semibold text-primary">Back to splash</Link>
      </p>
    </div>
  );
}
