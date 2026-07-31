/**
 * Checkout upsell rail — drinks, desserts, add-ons, combo upgrades and
 * frequently-bought-together picks chosen by the AI gateway from the cart's
 * own restaurant menu. Silent no-op when AI is unavailable.
 */
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { findRestaurant } from "@/lib/mock-data";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/auth-store";
import { runAI } from "@/lib/ai/client";
import { currency } from "@/lib/format";

type Suggestion = { dishId: string; kind: string; pitch: string };

export function AiUpsell({ restaurantId }: { restaurantId?: string }) {
  const { items, addItem, restaurantId: cartRestaurantId } = useCart();
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const rid = restaurantId ?? cartRestaurantId ?? items[0]?.restaurantId;

  useEffect(() => {
    let cancelled = false;
    if (!rid || !items?.length) {
      setSuggestions([]);
      return;
    }
    const restaurant = findRestaurant(rid);
    if (!restaurant) return;

    (async () => {
      const res = await runAI<{ suggestions: Suggestion[] }>(
        "upsell",
        {
          cart: items.map((i) => ({ id: i.dishId, name: i.name, qty: i.qty })),
          menu: restaurant.menu.map((d) => ({
            id: d.id,
            name: d.name,
            price: d.price,
            category: d.category,
            veg: d.veg,
          })),
          restaurant: restaurant.name,
        },
        { app: "customer", userId: user?.id },
      );
      if (cancelled) return;
      const list = Array.isArray(res.data?.suggestions) ? res.data!.suggestions : [];
      const cartIds = new Set(items.map((i) => i.dishId));
      setSuggestions(list.filter((s) => !cartIds.has(s.dishId)).slice(0, 4));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, items?.length]);

  if (!rid || !suggestions.length) return null;
  const restaurant = findRestaurant(rid);
  if (!restaurant) return null;

  return (
    <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} />
        <h3 className="text-sm font-bold">Goes well with your order</h3>
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
        {suggestions.map((s) => {
          const dish = restaurant.menu.find((d) => d.id === s.dishId);
          if (!dish) return null;
          return (
            <div key={s.dishId} className="w-40 shrink-0 rounded-2xl bg-secondary/60 p-2.5 ring-1 ring-border/50">
              <p className="truncate text-sm font-bold">{dish.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{s.pitch}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-extrabold">{currency(dish.price)}</span>
                <button
                  onClick={() =>
                    addItem({
                      dishId: dish.id,
                      name: dish.name,
                      image: dish.image,
                      price: dish.price,
                      restaurantId: restaurant.id,
                      restaurantName: restaurant.name,
                      customizations: [],
                    })
                  }
                  aria-label={`Add ${dish.name}`}
                  className="grid h-7 w-7 place-items-center rounded-full gradient-primary text-primary-foreground active:scale-95"
                >
                  <Plus className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
