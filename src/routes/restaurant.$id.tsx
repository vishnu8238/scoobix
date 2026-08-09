import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bike, Clock, Heart, MapPin, Search, Share2, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { findRestaurant, type Restaurant } from "@/lib/mock-data";
import { useCart, useFavorites } from "@/lib/stores";
import { useCms } from "@/lib/cms-store";
import { DishCard } from "@/components/cravio/DishCard";
import { GoogleMap as GoogleMap } from "@/components/maps/GoogleMap";
import { Button } from "@/components/ui/button";
import { currency, cn } from "@/lib/format";
import { restaurantCoords } from "@/lib/geo";
import { toast } from "sonner";

const CATS = ["Starters", "Main Course", "Drinks", "Desserts"] as const;

export const Route = createFileRoute("/restaurant/$id")({
  loader: ({ params }): Restaurant => {
    const r = findRestaurant(params.id);
    if (!r) throw notFound();
    return r;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} · Scoobix` : "Scoobix" },
      { name: "description", content: loaderData?.cuisine ?? "Order from premium restaurants on Scoobix." },
    ],
  }),
  component: RestaurantPage,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="text-sm">Restaurant not found.</p>
      <Link to="/app" className="mt-3 inline-block text-primary font-semibold">Back to home</Link>
    </div>
  ),
});

function RestaurantPage() {
  const r = Route.useLoaderData() as Restaurant;
  const navigate = useNavigate();
  const { isRestaurantFav, toggleRestaurant } = useFavorites();
  const { items, totals } = useCart();
  const { closedRestaurants } = useCms();
  const closed = !!closedRestaurants[r.id];
  const fav = isRestaurantFav(r.id);
  const [cat, setCat] = useState<(typeof CATS)[number]>("Starters");
  const [query, setQuery] = useState("");

  const dishes = useMemo(() => {
    return r.menu.filter((d) => d.category === cat && (!query || `${d.name} ${d.description}`.toLowerCase().includes(query.toLowerCase())));
  }, [r.menu, cat, query]);

  const hasCart = items.length > 0 && items[0].restaurantId === r.id;

  return (
    <div className="min-h-svh pb-32">
      <div className="relative h-56">
        <img src={r.cover} alt={r.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-background" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 backdrop-blur"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(`https://cravio.app/restaurant/${r.id}`); toast.success("Link copied"); }} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 backdrop-blur"><Share2 className="h-4 w-4" /></button>
            <button onClick={() => toggleRestaurant(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 backdrop-blur">
              <Heart className={cn("h-4 w-4", fav && "fill-primary text-primary")} />
            </button>
          </div>
        </div>
      </div>

      <div className="-mt-12 relative mx-4 rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold leading-tight">{r.name}</h1>
            <p className="text-xs text-muted-foreground">{r.cuisine} · {r.priceLevel}</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs font-bold text-primary">
            <Star className="h-3 w-3 fill-primary" /> {r.rating.toFixed(1)}
            <span className="text-[10px] font-medium text-primary/70">({r.reviews})</span>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.deliveryMins} min</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{r.distanceKm} km</span>
        </div>
        {closed && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-destructive text-destructive-foreground">!</span>
            <span className="font-semibold text-destructive">Closed right now — ordering is paused</span>
          </div>
        )}
        {!closed && r.offer && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary-soft/60 p-2.5 text-xs">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">%</span>
            <span className="font-semibold text-primary">{r.offer}</span>
          </div>
        )}
      </div>

      <div className="mt-4 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Location</h3>
          <span className="flex items-center gap-1 text-[11px] font-bold text-primary"><MapPin className="h-3 w-3" /> {r.distanceKm} km away</span>
        </div>
        <GoogleMap
          height={160}
          interactive={false}
          zoom={15}
          center={restaurantCoords(r.id)}
          markers={[{ id: r.id, kind: "restaurant", label: r.name, ...restaurantCoords(r.id) }]}
        />
      </div>


      <div className="sticky top-0 z-30 mt-4 glass border-b border-border/60">
        <div className="px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${r.name}'s menu`}
              className="h-10 w-full rounded-full bg-secondary pl-10 pr-4 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
            />
          </div>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition",
                cat === c ? "gradient-primary text-primary-foreground shadow-soft" : "bg-secondary text-muted-foreground",
              )}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className={cn("px-4", closed && "pointer-events-none opacity-60")}>
        {dishes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-semibold">Nothing here yet</p>
            <p className="text-xs text-muted-foreground">Try a different category or clear your search.</p>
          </div>
        ) : (
          dishes.map((d) => <DishCard key={d.id} dish={d} layout="row" />)
        )}
      </div>

      {hasCart && !closed && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] glass border-t border-border/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button onClick={() => navigate({ to: "/app/cart" })} className="h-13 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow">
            View cart · {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"} · {currency(totals.total)}
          </Button>
        </div>
      )}
    </div>
  );
}
