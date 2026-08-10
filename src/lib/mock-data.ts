import pizza from "@/assets/food-pizza.jpg";
import burger from "@/assets/hero-burger.jpg";
import biryani from "@/assets/food-biryani.jpg";
import sushi from "@/assets/food-sushi.jpg";
import healthy from "@/assets/food-healthy.jpg";
import dessert from "@/assets/food-dessert.jpg";
import drinks from "@/assets/food-drinks.jpg";
import wings from "@/assets/food-wings.jpg";
import tacos from "@/assets/food-tacos.jpg";
import pasta from "@/assets/food-pasta.jpg";
import r1 from "@/assets/restaurant-1.jpg";
import r2 from "@/assets/restaurant-2.jpg";
import r3 from "@/assets/restaurant-3.jpg";
import r4 from "@/assets/restaurant-4.jpg";

export const IMAGES = {
  pizza, burger, biryani, sushi, healthy, dessert, drinks, wings, tacos, pasta,
  r1, r2, r3, r4,
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  image: string;
};

// Categories are hydrated by bootstrapInsForge from the backend
export const categories: Category[] = [];

export type Dish = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  category: "Starters" | "Main Course" | "Drinks" | "Desserts";
  cuisineTag: string;
  veg?: boolean;
  popular?: boolean;
};

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
};

const mk = (
  id: string,
  partial: Omit<Dish, "id">,
): Dish => ({ id, ...partial });

// Restaurants and their menus are hydrated by bootstrapInsForge from the backend
export const restaurants: Restaurant[] = [];

export const offers = [
  {
    id: "o1",
    title: "50% OFF your first 3 orders",
    subtitle: "New on Scoobix? Eat well, pay less.",
    cta: "Claim now",
    code: "SCOOBIX50",
  },
  {
    id: "o2",
    title: "Free delivery all weekend",
    subtitle: "On orders over $15. No code needed.",
    cta: "Browse restaurants",
    code: "FREESHIP",
  },
  {
    id: "o3",
    title: "Late night, 20% OFF",
    subtitle: "10pm–2am. Cravings welcome.",
    cta: "See deals",
    code: "NIGHT20",
  },
];

export const quickOffers = [
  { id: "qo1", title: "Free delivery", subtitle: "On orders $15+", icon: "🚀", tone: "primary" as const },
  { id: "qo2", title: "Best deals", subtitle: "Up to 60% off", icon: "🔥", tone: "warm" as const },
  { id: "qo3", title: "New & trending", subtitle: "Discover hot spots", icon: "✨", tone: "cool" as const },
];

export const popularSearches = [
  "Pizza", "Sushi", "Biryani", "Burger", "Salad", "Cold brew", "Vegan", "Late night",
];

export const trendingDishIds: string[] = [];
export const recommendedDishIds: string[] = [];

export function allDishes(): Dish[] {
  return restaurants.flatMap((r) => r.menu);
}

export function findDish(id: string): { dish: Dish; restaurant: Restaurant } | null {
  for (const r of restaurants) {
    const d = r.menu.find((m) => m.id === id);
    if (d) return { dish: d, restaurant: r };
  }
  return null;
}

export function findRestaurant(id: string): Restaurant | undefined {
  return restaurants.find((r) => r.id === id);
}

export const savedAddresses = [
  { id: "a1", label: "Home", line1: "221B Baker Street", line2: "Apt 4 · Westside", default: true },
  { id: "a2", label: "Work", line1: "Scoobix HQ, 7th Floor", line2: "Innovation Park · Block C", default: false },
  { id: "a3", label: "Other", line1: "Iron Garden Gym", line2: "Riverside 88 · Locker 12", default: false },
];

export const paymentMethods = [
  { id: "p1", brand: "Visa", last4: "4242", default: true },
  { id: "p2", brand: "Mastercard", last4: "8821", default: false },
  { id: "p3", brand: "Apple Pay", last4: "—", default: false },
];

export const notifications = [
  { id: "n1", title: "Your order is on the way", body: "Trattoria Verde · arriving in ~8 min", time: "now", unread: true },
  { id: "n2", title: "20% off Sakura Sushi", body: "Tonight only. Tap to order.", time: "2h", unread: true },
  { id: "n3", title: "Order delivered", body: "Char & Crust · Hope you enjoyed!", time: "Yesterday", unread: false },
];
