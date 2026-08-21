import { Heart, Plus, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Dish, Restaurant } from "@/lib/mock-data";
import { findDish } from "@/lib/mock-data";
import { useCart, useFavorites } from "@/lib/stores";
import { currency, cn } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import { CustomizationSheet } from "./CustomizationSheet";
import { OptimizedImage } from "@/components/cravio/OptimizedImage";

export function DishCard({ dish, layout = "rail", restaurant }: { dish: Dish; layout?: "rail" | "row" | "grid"; restaurant?: Restaurant }) {
  
  const ref = findDish(dish.id);
  const { isDishFav, toggleDish } = useFavorites();
  const { addItem } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pop, setPop] = useState(0);
  const [addPop, setAddPop] = useState(0);
  const fav = isDishFav(dish.id);

  const quickAdd = () => {
    const activeRestaurant = restaurant || ref?.restaurant;
    if (!activeRestaurant) return;
    const res = addItem({
      dishId: dish.id,
      name: dish.name,
      image: dish.image,
      price: dish.price,
      restaurantId: activeRestaurant.id,
      restaurantName: activeRestaurant.name,
      customizations: [],
    });
    if (!res.ok && res.reason === "different-restaurant") {
      toast.error("Your cart has items from another restaurant", { description: "Clear cart to add from a new one." });
      return;
    }
    setAddPop((p) => p + 1);
    toast.success(`${dish.name} added`, { description: activeRestaurant.name });
  };

  const onFav = () => { toggleDish(dish.id); setPop((p) => p + 1); };

  if (layout === "row") {
    return (
      <>
        <div className="flex gap-4 py-4 border-b border-border/60 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3.5 w-3.5 rounded-[3px] border-[1.5px]", dish.veg ? "border-success" : "border-destructive")}>
                <span className={cn("block h-1.5 w-1.5 m-[3px] rounded-full", dish.veg ? "bg-success" : "bg-destructive")} />
              </span>
              {dish.popular && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">★ Popular</span>
              )}
            </div>
            <h4 className="mt-1.5 font-display text-[16px] font-bold leading-tight tracking-tight">{dish.name}</h4>
            <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">{dish.description}</p>
            <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-display text-[16px] font-extrabold text-foreground">{currency(dish.price)}</span>
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" /> {dish.rating.toFixed(1)}</span>
            </div>
          </div>
          <div className="relative w-28 shrink-0">
            <OptimizedImage src={dish.image} alt={dish.name} type="dish" className="h-28 w-28 rounded-3xl shadow-card" />
            <button
              onClick={() => setSheetOpen(true)}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-2xl bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-primary shadow-card ring-1 ring-border transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
        <CustomizationSheet open={sheetOpen} onOpenChange={setSheetOpen} dish={dish} restaurant={restaurant || ref?.restaurant} />
      </>
    );
  }

  // rail / grid card — premium floating add button
  return (
    <>
      <div className={cn("group shrink-0", layout === "rail" ? "w-[180px]" : "w-full")}>
        <div className="relative aspect-square overflow-hidden rounded-[28px] shadow-card">
          <Link to="/restaurant/$id" params={{ id: restaurant?.id || ref?.restaurant.id || "" }}>
            <img src={dish.image} alt={dish.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" decoding="async" />
          </Link>
          <button
            onClick={onFav}
            aria-label={fav ? "Unfavorite" : "Favorite"}
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full glass shadow-soft transition active:scale-90"
          >
            <Heart key={pop} className={cn("h-3.5 w-3.5 transition-colors", fav ? "fill-primary text-primary animate-pop" : "text-foreground")} />
          </button>
          <button
            onClick={quickAdd}
            aria-label="Add to cart"
            className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow ring-4 ring-white/60 transition active:scale-90"
          >
            <Plus key={addPop} className={cn("h-5 w-5", addPop > 0 && "animate-pop")} strokeWidth={3} />
          </button>
        </div>
        <div className="mt-3 px-1">
          <h4 className="truncate font-display text-[14px] font-bold leading-snug tracking-tight">{dish.name}</h4>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{restaurant?.name || ref?.restaurant.name}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-display text-[15px] font-extrabold text-primary-strong">{currency(dish.price)}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground">
              <Star className="h-3 w-3 fill-primary text-primary" />{dish.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      <CustomizationSheet open={sheetOpen} onOpenChange={setSheetOpen} dish={dish} restaurant={restaurant || ref?.restaurant} />
    </>
  );
}
