
import { listTable } from "./insforge-crud";
import { type Restaurant, type Dish } from "./mock-data";

export interface RestaurantRecord {
  id: string;
  name: string;
  cuisine?: string;
  rating?: number;
  reviews?: number;
  delivery_mins?: number;
  distance_km?: number;
  price_level?: string;
  cover_url?: string;
  logo_url?: string;
  offer_text?: string;
  is_live?: boolean;
  is_open?: boolean;
  city?: string;
  onboarding_status?: string;
  status?: string;
}

export interface MenuItemRecord {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  rating?: number;
  category?: string;
  cuisine_tag?: string;
  is_veg?: boolean;
  is_popular?: boolean;
  is_active?: boolean;
}

export async function fetchLiveRestaurants(): Promise<Restaurant[]> {
  try {
    // 1. Fetch restaurants
    // approved, active, and onboarding_status=live restaurants are eligible, 
    // including RST-10017 with is_live=true, is_open=true, city Vadodara
    const restaurantsRaw = await listTable<RestaurantRecord>("restaurants", {
      status: "eq.active",
      onboarding_status: "eq.live"
    });

    if (!restaurantsRaw || restaurantsRaw.length === 0) return [];

    // 2. Fetch menu items for all these restaurants
    const menuItemsRaw = await listTable<MenuItemRecord>("menu_items", {
      is_active: "eq.true"
    });

    // 3. Normalize and group
    return restaurantsRaw.map(r => {
      const menu: Dish[] = menuItemsRaw
        .filter(m => m.restaurant_id === r.id)
        .map(m => ({
          id: m.id,
          name: m.name,
          description: m.description || "",
          price: Number(m.price) || 0,
          image: m.image_url || "",
          rating: Number(m.rating) || 5.0,
          category: (m.category as any) || "Main Course",
          cuisineTag: m.cuisine_tag || r.cuisine || "General",
          veg: !!m.is_veg,
          popular: !!m.is_popular
        }));

      return {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine || "Cuisine",
        rating: Number(r.rating) || 4.5,
        reviews: Number(r.reviews) || 0,
        deliveryMins: Number(r.delivery_mins) || 30,
        distanceKm: Number(r.distance_km) || 1.5,
        priceLevel: (r.price_level as any) || "₹₹",
        cover: r.cover_url || "",
        logo: r.logo_url || "",
        offer: r.offer_text || undefined,
        tags: r.cuisine ? [r.cuisine] : [],
        menu
      };
    });
  } catch (err) {
    console.error("[RESTAURANT_API] Failed to fetch live restaurants:", err);
    throw err;
  }
}
