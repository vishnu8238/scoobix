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
  category: "Starters" | "Main Course" | "Drinks" | "Desserts" | string;
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
    // 1. Fetch all restaurants that have potential to be live
    // We fetch a broader set and filter in JS to handle case-insensitivity and complex flags
    const restaurants = await listTable<any>("restaurants", {
      limit: 100
    }, { ttl: 60 });

    // 2. Fetch all menu items for these restaurants
    const menuItems = await listTable<any>("menu_items", {
      limit: 1000
    }, { ttl: 120 });

    // 3. Normalize mapping & apply strict production eligibility filters
    const normalizedRestaurants: Restaurant[] = restaurants
      .filter(r => {
        // Requirement 1: Normalize statuses case-insensitively (approved, active)
        const status = String(r.status || "").toLowerCase();
        const onboarding = String(r.onboarding_status || "").toLowerCase();
        const isApproved = status === "approved" || status === "active" || onboarding === "live";

        // Requirement 2: Canonical live/override flags (is_live OR go_live_override)
        // Also ensure not archived and explicitly open
        const isLive = Boolean(r.is_live === true || r.is_live === "true" || r.go_live_override === true || r.go_live_override === "true");
        const isNotArchived = !Boolean(r.archived === true || r.archived === "true");
        const isOpen = Boolean(r.is_open ?? true);

        return isApproved && isLive && isNotArchived && isOpen;
      })
      .map(r => {
        const restaurantMenu = menuItems
          .filter(m => m.restaurant_id === r.id && Boolean(m.available ?? true))
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

        // Delivery time parsing: extract first positive numeric token or use fallback
        let deliveryMins = 25;
        const rawTime = String(r.delivery_time || r.deliveryMins || "");
        const match = rawTime.match(/\d+/);
        if (match) {
          deliveryMins = parseInt(match[0], 10);
        }

        return {
          id: r.id,
          name: r.name || "Unnamed Restaurant",
          cuisine: r.cuisine || "Multi-cuisine",
          rating: Number(r.rating || 4.0),
          reviews: Number(r.reviews_count || r.reviews || 0),
          deliveryMins: deliveryMins,
          distanceKm: Number(r.distance_km || r.distanceKm || 1.2),
          priceLevel: (r.price_level || r.priceLevel || "₹₹") as any,
          cover: r.cover_url || r.cover_image || r.cover || "",
          logo: r.logo_url || r.logo || "",
          offer: r.offer_text || r.offer || null,
          tags: Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',') : []),
          menu: restaurantMenu,
          is_live: true, // We already filtered for live
          is_open: true,
          onboarding_status: r.onboarding_status,
          city: r.city,
          rst_code: r.rst_code,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          delivery_radius: Number(r.delivery_radius || 5)
        } as any;
      })
      // Requirement: Drop restaurants with no available menu items
      .filter(r => r.menu.length > 0);

    return {
      restaurants: normalizedRestaurants,
      allDishes: normalizedRestaurants.flatMap(r => r.menu)
    };
  } catch (error) {
    console.error("[RESTAURANTS_API] Failed to fetch customer data:", error);
    return null;
  }
}
