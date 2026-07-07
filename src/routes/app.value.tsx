import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Tag } from "lucide-react";
import { useMemo } from "react";
import { TopBar } from "@/components/cravio/TopBar";
import { CategoryRail, SectionHeader } from "@/components/cravio/CategoryRail";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { allDishes, restaurants, recommendedDishIds } from "@/lib/mock-data";
import { useCms } from "@/lib/cms-store";
import { useAppUI } from "@/lib/stores";
import { filterVeg, filterVegDishes } from "@/lib/restaurant-extras";

export const Route = createFileRoute("/app/value")({
  head: () => ({
    meta: [
      { title: "Scoobix · Under ₹250" },
      { name: "description", content: "Affordable food picks — dishes, restaurants and offers under ₹250." },
    ],
  }),
  component: ValuePage,
});

const CAP = 250;

function ValuePage() {
  const { vegMode } = useAppUI();
  const { pureVegOverrides, closedRestaurants } = useCms();

  const allD = useMemo(() => allDishes(), []);
  const cheapDishes = useMemo(
    () => filterVegDishes(allD.filter((d) => d.price <= CAP), vegMode).slice(0, 12),
    [allD, vegMode],
  );
  const recDishes = useMemo(() => {
    const list = recommendedDishIds
      .map((id) => allD.find((d) => d.id === id)!)
      .filter((d) => d && d.price <= CAP);
    return filterVegDishes(list, vegMode);
  }, [allD, vegMode]);

  const cheapRestaurants = useMemo(() => {
    const list = restaurants.filter((r) => r.menu.some((d) => d.price <= CAP));
    return filterVeg(list, vegMode, pureVegOverrides);
  }, [vegMode, pureVegOverrides]);

  const popularCheap = useMemo(
    () => filterVegDishes(allD.filter((d) => d.price <= CAP && d.popular), vegMode),
    [allD, vegMode],
  );

  return (
    <div className="space-y-7 animate-fade-up pb-6">
      <TopBar />

      <div className="px-5 -mt-3">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-3xl bg-primary-soft/40 p-4 ring-1 ring-primary/20">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Tag className="h-5 w-5" strokeWidth={2.6} />
          </span>
          <div>
            <h1 className="font-display text-lg font-extrabold tracking-tight">Under ₹250</h1>
            <p className="text-xs text-muted-foreground">Wallet-friendly picks · {cheapDishes.length} dishes · {cheapRestaurants.length} places</p>
          </div>
        </div>
      </div>

      <CategoryRail />

      {recDishes.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Recommended for you" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
            {recDishes.map((d) => <DishCard key={d.id} dish={d} />)}
          </div>
        </section>
      )}

      {popularCheap.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Popular items under ₹250" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 pb-2">
            {popularCheap.map((d) => <DishCard key={d.id} dish={d} />)}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader title="Recommended restaurants" />
        <div className="space-y-7 px-5">
          {cheapRestaurants.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No restaurants match — try turning Veg mode off.</p>
          ) : (
            cheapRestaurants.slice(0, 6).map((r) => (
              <RestaurantCard key={r.id} r={r} closed={!!closedRestaurants[r.id]} />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="All dishes under ₹250" />
        <div className="grid grid-cols-2 gap-4 px-5">
          {cheapDishes.map((d) => <DishCard key={d.id} dish={d} layout="grid" />)}
        </div>
      </section>
    </div>
  );
}
