import { Link } from "@tanstack/react-router";
import { Star, Clock, Bike, Heart } from "lucide-react";
import type { Restaurant } from "@/lib/mock-data";
import { useFavorites } from "@/lib/stores";
import { cn } from "@/lib/format";

export function RestaurantCard({ r, variant = "full" }: { r: Restaurant; variant?: "full" | "compact" }) {
  const { isRestaurantFav, toggleRestaurant } = useFavorites();
  const fav = isRestaurantFav(r.id);

  if (variant === "compact") {
    return (
      <Link to="/restaurant/$id" params={{ id: r.id }} className="group block w-[260px] shrink-0">
        <div className="relative h-36 overflow-hidden rounded-2xl shadow-card">
          <img src={r.cover} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          {r.offer && (
            <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-soft">
              {r.offer}
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); toggleRestaurant(r.id); }}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-foreground backdrop-blur transition hover:scale-110"
          >
            <Heart className={cn("h-4 w-4", fav && "fill-primary text-primary")} />
          </button>
        </div>
        <div className="mt-2 px-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-bold">{r.name}</h4>
            <span className="flex items-center gap-0.5 text-xs font-semibold">
              <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.cuisine}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to="/restaurant/$id" params={{ id: r.id }} className="group block">
      <div className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60 transition-transform hover:scale-[1.01]">
        <div className="relative h-44">
          <img src={r.cover} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          {r.offer && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-soft">
              {r.offer}
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); toggleRestaurant(r.id); }}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground backdrop-blur transition hover:scale-110"
          >
            <Heart className={cn("h-[18px] w-[18px]", fav && "fill-primary text-primary")} />
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-soft">
              <img src={r.logo} alt="" className="h-full w-full rounded-xl object-cover" loading="lazy" />
            </span>
          </div>
        </div>
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[15px] font-bold leading-tight">{r.name}</h4>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
              <Star className="h-3 w-3 fill-primary" /> {r.rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">{r.cuisine} · {r.priceLevel}</p>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.deliveryMins} min</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{r.distanceKm} km</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
