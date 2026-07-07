import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useFavorites } from "@/lib/stores";
import { restaurants, allDishes } from "@/lib/mock-data";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useState } from "react";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/app/favorites")({
  head: () => ({ meta: [{ title: "Scoobix · Favorites" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const fav = useFavorites();
  const dishes = allDishes();
  const favRestaurants = restaurants.filter((r) => fav.isRestaurantFav(r.id));
  const favDishes = dishes.filter((d) => fav.isDishFav(d.id));
  const [tab, setTab] = useState<"r" | "d">("r");

  const empty = favRestaurants.length === 0 && favDishes.length === 0;

  return (
    <div className="min-h-svh pb-24">
      <PageHeader title="Favorites" subtitle={`${favRestaurants.length + favDishes.length} saved`} />

      {empty ? (
        <EmptyState
          icon={<Heart className="h-9 w-9" />}
          title="No favorites yet"
          description="Tap the heart on any restaurant or dish to save it here for quick reordering."
          action={{ label: "Discover food", to: "/app" }}
        />
      ) : (
        <>
          <div className="mx-4 mt-3 grid grid-cols-2 rounded-full bg-secondary p-1">
            {[{ k: "r", l: `Restaurants · ${favRestaurants.length}` }, { k: "d", l: `Dishes · ${favDishes.length}` }].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as "r" | "d")}
                className={cn(
                  "rounded-full py-2 text-[12px] font-bold transition",
                  tab === t.k ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
                )}
              >{t.l}</button>
            ))}
          </div>

          {tab === "r" && (
            <div className="mt-5 space-y-7 px-4">
              {favRestaurants.length === 0
                ? <p className="py-12 text-center text-sm text-muted-foreground">No saved restaurants yet.</p>
                : favRestaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}
            </div>
          )}

          {tab === "d" && (
            <div className="mt-5 grid grid-cols-2 gap-4 px-4">
              {favDishes.length === 0
                ? <p className="col-span-2 py-12 text-center text-sm text-muted-foreground">No saved dishes yet.</p>
                : favDishes.map((d) => <DishCard key={d.id} dish={d} />)}
            </div>
          )}

          <Link to="/app" className="mx-4 mt-6 block rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
            + Find more to love
          </Link>
        </>
      )}
    </div>
  );
}
