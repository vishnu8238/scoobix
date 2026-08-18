import { listTable } from "./insforge-crud";

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  deliveryMins: number;
  distanceKm: number;
  priceLevel: "₹" | "₹₹" | "₹₹₹";
  cover: string;
  logo: string;
  offer?: string;
  tags: string[];
  menu: Dish[];
  is_live?: boolean;
  is_open?: boolean;
  onboarding_status?: string;
  city?: string;
  rst_code?: string;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  category: string;
  cuisineTag: string;
  veg?: boolean;
  popular?: boolean;
  restaurant_id?: string;
};

/**
 * Authoritative Customer Data Loader.
 * Fetches restaurants and menu items from InsForge public tables.
 */
export async function fetchCustomerData() {
  try {
    // 1. Fetch Approved/Live restaurants
    // Filters: status=approved, onboarding_status=live, is_live=true
    const restaurants = await listTable<any>("restaurants", {
      "onboarding_status.eq": "live",
      "status.eq": "approved",
      "is_live.eq": "true",
      limit: 100
    }, { ttl: 60 });

    // 2. Fetch all menu items for these restaurants
    const menuItems = await listTable<any>("menu_items", {
      limit: 1000
    }, { ttl: 120 });

    // 3. Normalize mapping
    const normalizedRestaurants: Restaurant[] = restaurants.map(r => {
      const restaurantMenu = menuItems
        .filter(m => m.restaurant_id === r.id)
        .map(m => ({
          id: m.id,
          name: m.name || "Unnamed Dish",
          description: m.description || "",
          price: Number(m.price || 0),
          image: m.image_url || m.image || "",
          rating: Number(m.rating || 4.5),
          category: m.category || "Main Course",
          cuisineTag: m.cuisine_tag || r.cuisine || "General",
          veg: Boolean(m.is_veg ?? m.veg),
          popular: Boolean(m.is_popular ?? m.popular),
          restaurant_id: r.id
        }));

      return {
        id: r.id,
        name: r.name || "Unnamed Restaurant",
        cuisine: r.cuisine || "Multi-cuisine",
        rating: Number(r.rating || 4.0),
        reviews: Number(r.reviews_count || r.reviews || 0),
        deliveryMins: Number(r.delivery_time || r.deliveryMins || 25),
        distanceKm: Number(r.distance_km || r.distanceKm || 1.2),
        priceLevel: (r.price_level || r.priceLevel || "₹₹") as any,
        cover: r.cover_url || r.cover_image || r.cover || "",
        logo: r.logo_url || r.logo || "",
        offer: r.offer_text || r.offer || null,
        tags: Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',') : []),
        menu: restaurantMenu,
        is_live: Boolean(r.is_live),
        is_open: Boolean(r.is_open ?? true),
        onboarding_status: r.onboarding_status,
        city: r.city,
        rst_code: r.rst_code
      };
    });

    return {
      restaurants: normalizedRestaurants,
      allDishes: normalizedRestaurants.flatMap(r => r.menu)
    };
  } catch (error) {
    console.error("[RESTAURANTS_API] Failed to fetch customer data:", error);
    return null;
  }
}
