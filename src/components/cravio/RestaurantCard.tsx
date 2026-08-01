import { Link } from "@tanstack/react-router";
import { Star, Clock, Bike, Heart } from "lucide-react";
import type { Restaurant } from "@/lib/mock-data";
import { useFavorites } from "@/lib/stores";
import { useAds } from "@/lib/ads-store";
import { SponsoredBadge } from "@/components/cravio/SponsoredBadge";
import { cn } from "@/lib/format";
import { useState } from "react";

export function RestaurantCard({ r, variant = "full", closed = false, sponsored: sponsoredProp }: { r: Restaurant; variant?: "full" | "compact"; closed?: boolean; sponsored?: boolean }) {
  const { isSponsored } = useAds();
  const sponsored = sponsoredProp ?? isSponsored(r.id);
  const { isRestaurantFav, toggleRestaurant } = useFavorites();
  const fav = isRestaurantFav(r.id);
  const [pop, setPop] = useState(0);

  const onFav = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleRestaurant(r.id);
    setPop((p) => p + 1);
  };

  if (variant === "compact") {
    return (
      <Link to="/restaurant/$id" params={{ id: r.id }} className={cn("group block w-[260px] shrink-0", closed && "pointer-events-none opacity-70")}>
        <div className="relative h-40 overflow-hidden rounded-[28px] shadow-card">
          <img src={r.cover} alt={r.name} className={cn("h-full w-full object-cover transition-transform duration-700 group-hover:scale-110", closed && "grayscale")} loading="lazy" decoding="async" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
          {closed && (
            <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white">Closed</span>
          )}
          {!closed && r.offer && (
            <span className="absolute left-3 bottom-3 rounded-full glass-dark px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest">
              {r.offer}
            </span>
          )}
          {sponsored && !closed && (
            <SponsoredBadge className="absolute bottom-3 right-3" dark />
          )}
          <span className="absolute right-3 top-3 glass flex items-center gap-1 rounded-full px-2.5 py-1 shadow-soft">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-[11px] font-extrabold">{r.rating.toFixed(1)}</span>
          </span>
          {!closed && (
            <button
              onClick={onFav}
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
              className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full glass shadow-soft transition active:scale-90"
            >
              <Heart key={pop} className={cn("h-4 w-4 transition-colors", fav ? "fill-primary text-primary animate-pop" : "text-foreground")} />
            </button>
          )}
        </div>
        <div className="mt-2.5 px-1">
          <h4 className="truncate font-display text-[15px] font-bold tracking-tight">{r.name}</h4>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{r.cuisine} · {r.deliveryMins} min</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to="/restaurant/$id" params={{ id: r.id }} className={cn("group block", closed && "pointer-events-none opacity-70")}>
      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] shadow-card">
          <img src={r.cover} alt={r.name} className={cn("h-full w-full object-cover transition-transform duration-700 group-hover:scale-105", closed && "grayscale")} loading="lazy" decoding="async" />

          {closed && (
            <div className="absolute inset-0 grid place-items-center bg-foreground/30">
              <span className="rounded-full bg-foreground/90 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white">Currently closed</span>
            </div>
          )}

          {/* Rating glass pill */}
          <span className="absolute right-4 top-4 glass flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-soft">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="font-display text-[13px] font-extrabold">{r.rating.toFixed(1)}</span>
          </span>

          {/* Favorite */}
          <button
            onClick={onFav}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full glass shadow-soft transition active:scale-90"
          >
            <Heart key={pop} className={cn("h-4.5 w-4.5 transition-colors", fav ? "fill-primary text-primary animate-pop" : "text-foreground")} />
          </button>

          {/* Bottom tag pills */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <span className="glass-dark rounded-2xl px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest">
              {r.deliveryMins} min
            </span>
            {r.offer ? (
              <span className="rounded-2xl bg-primary px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-primary-foreground shadow-glow">
                {r.offer}
              </span>
            ) : (
              <span className="glass rounded-2xl px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-foreground">
                Free delivery
              </span>
            )}
          </div>
          {sponsored && !closed && (
            <SponsoredBadge className="absolute right-4 bottom-4" />
          )}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h4 className="truncate font-display text-[18px] font-extrabold leading-tight tracking-tight">{r.name}</h4>
            <p className="mt-1 truncate text-[13px] font-medium text-muted-foreground">
              {r.cuisine} · {r.priceLevel}
            </p>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.deliveryMins} min</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="inline-flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{r.distanceKm} km</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
