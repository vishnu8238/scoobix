/**
 * AI-personalised discovery rails for the customer home screen.
 *
 * Sections are chosen by the gateway from live catalog + the customer's own
 * order history, favourites, budget, time of day and day of week. Falls back
 * to the existing (non-AI) rails silently when AI is unavailable.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { restaurants, allDishes } from "@/lib/mock-data";
import { RestaurantCard } from "@/components/cravio/RestaurantCard";
import { DishCard } from "@/components/cravio/DishCard";
import { useAuth } from "@/lib/auth-store";
import { logRecommendation, runAI, getCustomerPreferences } from "@/lib/ai/client";
import { fetchCustomerOrders } from "@/lib/orders-api";

type Section = { key: string; title: string; reason: string; restaurantIds: string[]; dishIds: string[] };

const SECTION_KEYS = [
  "recommended_for_you",
  "because_you_ordered",
  "trending_near_you",
  "healthy_picks",
  "budget_meals",
  "weekend_specials",
  "late_night",
  "new_restaurants",
  "popular_in_vadodara",
];

export function AiRecommendations() {
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const catalog = useMemo(
    () => ({
      restaurants: restaurants.slice(0, 40).map((r) => ({
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        rating: r.rating,
        deliveryMins: r.deliveryMins,
        price: r.priceLevel,
        tags: r.tags,
      })),
      dishes: allDishes()
        .slice(0, 60)
        .map((d) => ({ id: d.id, name: d.name, price: d.price, veg: d.veg, cuisine: d.cuisineTag, category: d.category })),
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const [history, prefs] = await Promise.all([
        user?.id ? fetchCustomerOrders(user.id).catch(() => []) : Promise.resolve([]),
        user?.id ? getCustomerPreferences(user.id).catch(() => null) : Promise.resolve(null),
      ]);

      const res = await runAI<{ sections: Section[] }>(
        "recommend_sections",
        {
          sections: SECTION_KEYS,
          catalog,
          preferences: prefs,
          hour: now.getHours(),
          dayOfWeek: now.toLocaleDateString("en-IN", { weekday: "long" }),
          city: "Vadodara",
          recentOrders: (history as { total?: number; restaurantId?: string; restaurantName?: string }[])
            .slice(0, 8)
            .map((o) => ({ restaurant: o.restaurantName, total: o.total })),
        },
        { app: "customer", userId: user?.id },
      );

      if (cancelled) return;
      const list = Array.isArray(res.data?.sections) ? res.data!.sections : [];
      setSections(list.filter((s) => s.restaurantIds?.length || s.dishIds?.length).slice(0, 6));
      setLoading(false);
      if (res.ok && list.length) void logRecommendation({ userId: user?.id, section: "home", payload: list });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, catalog]);

  if (loading || !sections.length) return null;

  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const rs = s.restaurantIds?.map((id) => restaurants.find((r) => r.id === id)).filter(Boolean) ?? [];
        const ds = s.dishIds?.map((id) => allDishes().find((d) => d.id === id)).filter(Boolean) ?? [];
        if (!rs.length && !ds.length) return null;
        return (
          <section key={s.key}>
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} />
              <h3 className="text-sm font-bold">{s.title}</h3>
            </div>
            {s.reason && <p className="px-1 text-xs text-muted-foreground">{s.reason}</p>}
            {ds.length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-2">
                {ds.slice(0, 8).map((d) => (
                  <DishCard key={d!.id} dish={d!} />
                ))}
              </div>
            )}
            {rs.length > 0 && (
              <div className="mt-2 space-y-3.5">
                {rs.slice(0, 3).map((r) => (
                  <RestaurantCard key={r!.id} r={r!} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
