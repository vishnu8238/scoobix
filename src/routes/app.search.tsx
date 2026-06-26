import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Filter, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allDishes, popularSearches, restaurants } from "@/lib/mock-data";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { useAppUI } from "@/lib/stores";
import { cn } from "@/lib/format";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/app/search")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Cravio · Search" }] }),
  component: SearchPage,
});

const CUISINES = ["All", "Italian", "Japanese", "Indian", "American", "Mexican", "Healthy", "BBQ", "Desserts"];
const SORTS = [
  { id: "rating", label: "Top rated" },
  { id: "fast",   label: "Fastest" },
  { id: "near",   label: "Nearest" },
  { id: "cheap",  label: "Price: low to high" },
] as const;

function SearchPage() {
  const navigate = useNavigate();
  const { q: initialQ } = Route.useSearch();
  const { recentSearches, pushRecent, clearRecent } = useAppUI();

  const [q, setQ] = useState(initialQ ?? "");
  const [cuisine, setCuisine] = useState("All");
  const [minRating, setMinRating] = useState(0);
  const [maxMins, setMaxMins] = useState(60);
  const [maxPrice, setMaxPrice] = useState<"₹" | "₹₹" | "₹₹₹">("₹₹₹");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("rating");
  const [filterOpen, setFilterOpen] = useState(false);

  // commit search term to recent when user pauses typing
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => pushRecent(q), 800);
    return () => clearTimeout(t);
  }, [q, pushRecent]);

  const dishes = useMemo(() => allDishes(), []);

  const filteredRestaurants = useMemo(() => {
    let list = restaurants.filter((r) => {
      if (cuisine !== "All" && !r.cuisine.toLowerCase().includes(cuisine.toLowerCase()) && !r.tags.some((t) => t.toLowerCase() === cuisine.toLowerCase())) return false;
      if (r.rating < minRating) return false;
      if (r.deliveryMins > maxMins) return false;
      if (r.priceLevel.length > maxPrice.length) return false;
      if (q && !`${r.name} ${r.cuisine} ${r.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "fast") return a.deliveryMins - b.deliveryMins;
      if (sort === "near") return a.distanceKm - b.distanceKm;
      if (sort === "cheap") return a.priceLevel.length - b.priceLevel.length;
      return 0;
    });
    return list;
  }, [q, cuisine, minRating, maxMins, maxPrice, sort]);

  const filteredDishes = useMemo(() => {
    if (!q) return [];
    return dishes.filter((d) => `${d.name} ${d.description} ${d.cuisineTag}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  }, [dishes, q]);

  const activeFiltersCount = (cuisine !== "All" ? 1 : 0) + (minRating > 0 ? 1 : 0) + (maxMins < 60 ? 1 : 0) + (maxPrice !== "₹₹₹" ? 1 : 0);

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search restaurants, dishes & cuisines"
              className="h-11 w-full rounded-full bg-secondary pl-10 pr-10 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <button className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary">
                <Filter className="h-4 w-4" />
                {activeFiltersCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{activeFiltersCount}</span>}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[88svh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Refine to find exactly what you crave.</SheetDescription>
              </SheetHeader>

              <FilterGroup label="Sort by">
                <div className="grid grid-cols-2 gap-2">
                  {SORTS.map((s) => (
                    <button key={s.id} onClick={() => setSort(s.id)} className={cn("rounded-full border-2 px-3 py-2 text-sm font-semibold", sort === s.id ? "border-primary bg-primary-soft text-primary" : "border-border")}>{s.label}</button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Cuisine">
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((c) => (
                    <button key={c} onClick={() => setCuisine(c)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", cuisine === c ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground")}>{c}</button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label={`Min rating · ${minRating.toFixed(1)}★`}>
                <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(e) => setMinRating(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
              </FilterGroup>

              <FilterGroup label={`Delivery within · ${maxMins} min`}>
                <input type="range" min={15} max={60} step={5} value={maxMins} onChange={(e) => setMaxMins(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
              </FilterGroup>

              <FilterGroup label="Max price">
                <div className="grid grid-cols-3 gap-2">
                  {(["₹", "₹₹", "₹₹₹"] as const).map((p) => (
                    <button key={p} onClick={() => setMaxPrice(p)} className={cn("rounded-2xl border-2 py-2 text-sm font-bold", maxPrice === p ? "border-primary bg-primary-soft text-primary" : "border-border")}>{p}</button>
                  ))}
                </div>
              </FilterGroup>

              <div className="mt-6 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setCuisine("All"); setMinRating(0); setMaxMins(60); setMaxPrice("₹₹₹"); setSort("rating"); }}
                  className="flex-1 rounded-full"
                >Reset</Button>
                <Button onClick={() => setFilterOpen(false)} className="flex-1 rounded-full gradient-primary text-primary-foreground">Show results</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {!q && (
          <>
            {recentSearches.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent</h3>
                  <button onClick={clearRecent} className="text-xs font-semibold text-primary">Clear</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentSearches.map((s) => (
                    <button key={s} onClick={() => setQ(s)} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">{s}</button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Popular searches</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {popularSearches.map((s) => (
                  <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:bg-primary-soft/40">{s}</button>
                ))}
              </div>
            </section>
          </>
        )}

        {q && filteredDishes.length > 0 && (
          <section>
            <h3 className="px-1 text-sm font-bold">Dishes</h3>
            <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-2">
              {filteredDishes.map((d) => <DishCard key={d.id} dish={d} />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold">{q ? "Restaurants" : "All restaurants"}</h3>
            <span className="text-xs text-muted-foreground">{filteredRestaurants.length} result{filteredRestaurants.length === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-3 space-y-3.5">
            {filteredRestaurants.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-4xl">🍽</p>
                <p className="mt-2 text-sm font-semibold">No matches</p>
                <p className="text-xs text-muted-foreground">Try a different search or relax the filters.</p>
              </div>
            ) : (
              filteredRestaurants.map((r) => <RestaurantCard key={r.id} r={r} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h4>
      {children}
    </div>
  );
}
