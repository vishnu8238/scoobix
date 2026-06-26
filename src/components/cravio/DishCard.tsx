import { Heart, Plus, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Dish } from "@/lib/mock-data";
import { findDish } from "@/lib/mock-data";
import { useCart, useFavorites } from "@/lib/stores";
import { currency, cn } from "@/lib/format";
import { toast } from "sonner";
import { useState } from "react";
import { CustomizationSheet } from "./CustomizationSheet";

export function DishCard({ dish, layout = "rail" }: { dish: Dish; layout?: "rail" | "row" | "grid" }) {
  const ref = findDish(dish.id);
  const { isDishFav, toggleDish } = useFavorites();
  const { addItem } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const fav = isDishFav(dish.id);

  const quickAdd = () => {
    if (!ref) return;
    const res = addItem({
      dishId: dish.id,
      name: dish.name,
      image: dish.image,
      price: dish.price,
      restaurantId: ref.restaurant.id,
      restaurantName: ref.restaurant.name,
      customizations: [],
    });
    if (!res.ok && res.reason === "different-restaurant") {
      setSheetOpen(true); // surface conflict via sheet for clarity? simpler: toast
      toast.error("Your cart has items from another restaurant", { description: "Clear cart to add from a new one." });
      return;
    }
    toast.success(`${dish.name} added`, { description: ref.restaurant.name });
  };

  if (layout === "row") {
    return (
      <>
        <div className="flex gap-3 py-3 border-b border-border/60 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("inline-block h-3 w-3 rounded-[3px] border", dish.veg ? "border-success" : "border-destructive")}>
                <span className={cn("block h-1.5 w-1.5 m-[3px] rounded-full", dish.veg ? "bg-success" : "bg-destructive")} />
              </span>
              {dish.popular && (
                <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">★ Popular</span>
              )}
            </div>
            <h4 className="mt-1 text-[15px] font-bold leading-tight">{dish.name}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{dish.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-[15px] font-bold text-foreground">{currency(dish.price)}</span>
              <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" /> {dish.rating.toFixed(1)}</span>
            </div>
          </div>
          <div className="relative w-28 shrink-0">
            <img src={dish.image} alt={dish.name} className="h-24 w-28 rounded-2xl object-cover shadow-soft" loading="lazy" />
            <button
              onClick={() => setSheetOpen(true)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary shadow-card ring-1 ring-border transition hover:scale-105"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
        <CustomizationSheet open={sheetOpen} onOpenChange={setSheetOpen} dish={dish} />
      </>
    );
  }

  // rail / grid card
  return (
    <>
      <div className={cn(
        "shrink-0 overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border/60",
        layout === "rail" ? "w-[170px]" : "w-full",
      )}>
        <div className="relative h-32">
          <Link to="/restaurant/$id" params={{ id: ref?.restaurant.id ?? "" }}>
            <img src={dish.image} alt={dish.name} className="h-full w-full object-cover" loading="lazy" />
          </Link>
          <button
            onClick={() => toggleDish(dish.id)}
            aria-label={fav ? "Unfavorite" : "Favorite"}
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-foreground backdrop-blur"
          >
            <Heart className={cn("h-3.5 w-3.5", fav && "fill-primary text-primary")} />
          </button>
          <button
            onClick={quickAdd}
            aria-label="Add to cart"
            className="absolute -bottom-3 right-2 grid h-8 w-8 place-items-center rounded-full gradient-primary text-primary-foreground shadow-card transition hover:scale-110"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2.5 pt-3">
          <h4 className="truncate text-[13px] font-bold">{dish.name}</h4>
          <p className="truncate text-[11px] text-muted-foreground">{ref?.restaurant.name}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold">{currency(dish.price)}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-foreground">
              <Star className="h-3 w-3 fill-primary text-primary" />{dish.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      <CustomizationSheet open={sheetOpen} onOpenChange={setSheetOpen} dish={dish} />
    </>
  );
}
