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

export const categories: Category[] = [
  { id: "pizza",    name: "Pizza",     emoji: "🍕", image: pizza },
  { id: "burgers",  name: "Burgers",   emoji: "🍔", image: burger },
  { id: "biryani",  name: "Biryani",   emoji: "🍛", image: biryani },
  { id: "sushi",    name: "Sushi",     emoji: "🍣", image: sushi },
  { id: "healthy",  name: "Healthy",   emoji: "🥗", image: healthy },
  { id: "desserts", name: "Desserts",  emoji: "🍰", image: dessert },
  { id: "drinks",   name: "Drinks",    emoji: "🥤", image: drinks },
  { id: "tacos",    name: "Mexican",   emoji: "🌮", image: tacos },
];

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

export const restaurants: Restaurant[] = [
  {
    id: "verdant-kitchen",
    name: "Verdant Kitchen",
    cuisine: "Healthy · Bowls",
    rating: 4.8, reviews: 2143,
    deliveryMins: 22, distanceKm: 1.2,
    priceLevel: "₹₹",
    cover: r1, logo: healthy,
    offer: "Free delivery",
    tags: ["Vegan", "Gluten-free", "Organic"],
    menu: [
      mk("v1", { name: "Sunrise Buddha Bowl", description: "Quinoa, avocado, roasted yam, kale, miso-tahini.", price: 1080, image: healthy, rating: 4.9, category: "Main Course", cuisineTag: "Healthy", veg: true, popular: true }),
      mk("v2", { name: "Citrus Salmon Bowl", description: "Wild salmon, brown rice, edamame, citrus glaze.", price: 1280, image: sushi, rating: 4.8, category: "Main Course", cuisineTag: "Healthy" }),
      mk("v3", { name: "Matcha Almond Latte", description: "Stone-ground matcha, almond milk, lightly sweetened.", price: 440, image: drinks, rating: 4.7, category: "Drinks", cuisineTag: "Healthy", veg: true }),
      mk("v4", { name: "Berry Chia Parfait", description: "Coconut yogurt, chia, wild berries, granola.", price: 520, image: dessert, rating: 4.6, category: "Desserts", cuisineTag: "Healthy", veg: true }),
      mk("v5", { name: "Charred Greens Plate", description: "Broccolini, asparagus, lemon, chili crisp.", price: 720, image: healthy, rating: 4.5, category: "Starters", cuisineTag: "Healthy", veg: true }),
    ],
  },
  {
    id: "trattoria-verde",
    name: "Trattoria Verde",
    cuisine: "Italian · Wood-fired",
    rating: 4.7, reviews: 3890,
    deliveryMins: 28, distanceKm: 1.8,
    priceLevel: "₹₹",
    cover: r2, logo: pizza,
    offer: "20% OFF over $25",
    tags: ["Italian", "Pizza", "Pasta"],
    menu: [
      mk("t1", { name: "Margherita Verace", description: "San Marzano, fior di latte, basil, EVOO.", price: 1120, image: pizza, rating: 4.9, category: "Main Course", cuisineTag: "Italian", veg: true, popular: true }),
      mk("t2", { name: "Truffle Carbonara", description: "Guanciale, pecorino, black pepper, shaved truffle.", price: 1480, image: pasta, rating: 4.8, category: "Main Course", cuisineTag: "Italian", popular: true }),
      mk("t3", { name: "Burrata & Heirloom", description: "Creamy burrata, heirloom tomatoes, basil oil.", price: 960, image: healthy, rating: 4.7, category: "Starters", cuisineTag: "Italian", veg: true }),
      mk("t4", { name: "Tiramisu Classico", description: "Mascarpone, espresso-soaked savoiardi, cocoa.", price: 680, image: dessert, rating: 4.8, category: "Desserts", cuisineTag: "Italian", veg: true }),
      mk("t5", { name: "Aperol Spritz", description: "Aperol, prosecco, soda, orange.", price: 720, image: drinks, rating: 4.6, category: "Drinks", cuisineTag: "Italian" }),
    ],
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi Bar",
    cuisine: "Japanese · Omakase",
    rating: 4.9, reviews: 1567,
    deliveryMins: 32, distanceKm: 2.4,
    priceLevel: "₹₹₹",
    cover: r3, logo: sushi,
    offer: "Free miso soup",
    tags: ["Japanese", "Sushi", "Premium"],
    menu: [
      mk("s1", { name: "Omakase 12-piece", description: "Chef's selection of seasonal nigiri.", price: 2560, image: sushi, rating: 4.9, category: "Main Course", cuisineTag: "Japanese", popular: true }),
      mk("s2", { name: "Salmon Aburi Roll", description: "Torched salmon, avocado, citrus yuzu.", price: 1360, image: sushi, rating: 4.8, category: "Main Course", cuisineTag: "Japanese" }),
      mk("s3", { name: "Edamame with Sea Salt", description: "Steamed soybeans, Maldon sea salt.", price: 440, image: healthy, rating: 4.5, category: "Starters", cuisineTag: "Japanese", veg: true }),
      mk("s4", { name: "Matcha Cheesecake", description: "Stone-ground matcha, cream cheese, biscuit base.", price: 720, image: dessert, rating: 4.7, category: "Desserts", cuisineTag: "Japanese", veg: true }),
      mk("s5", { name: "Yuzu Sparkling", description: "Sparkling water, yuzu, mint.", price: 360, image: drinks, rating: 4.4, category: "Drinks", cuisineTag: "Japanese", veg: true }),
    ],
  },
  {
    id: "spice-symphony",
    name: "Spice Symphony",
    cuisine: "Indian · Tandoor",
    rating: 4.7, reviews: 4321,
    deliveryMins: 30, distanceKm: 2.1,
    priceLevel: "₹₹",
    cover: r4, logo: biryani,
    offer: "Buy 1 Get 1 on Biryani",
    tags: ["Indian", "Spicy", "Tandoor"],
    menu: [
      mk("i1", { name: "Hyderabadi Dum Biryani", description: "Aged basmati, saffron, slow-cooked lamb.", price: 1280, image: biryani, rating: 4.9, category: "Main Course", cuisineTag: "Indian", popular: true }),
      mk("i2", { name: "Butter Chicken", description: "Tandoor chicken, tomato-cashew gravy, butter.", price: 1160, image: wings, rating: 4.8, category: "Main Course", cuisineTag: "Indian" }),
      mk("i3", { name: "Paneer Tikka", description: "Cottage cheese, yogurt-spice marinade, charcoal.", price: 840, image: wings, rating: 4.6, category: "Starters", cuisineTag: "Indian", veg: true }),
      mk("i4", { name: "Gulab Jamun", description: "Cardamom-rose syrup soaked dumplings.", price: 400, image: dessert, rating: 4.7, category: "Desserts", cuisineTag: "Indian", veg: true }),
      mk("i5", { name: "Masala Chai", description: "Loose-leaf Assam, ginger, cardamom, milk.", price: 280, image: drinks, rating: 4.5, category: "Drinks", cuisineTag: "Indian", veg: true }),
    ],
  },
  {
    id: "char-and-crust",
    name: "Char & Crust",
    cuisine: "Burgers · Smashed",
    rating: 4.6, reviews: 5210,
    deliveryMins: 18, distanceKm: 0.9,
    priceLevel: "₹₹",
    cover: burger, logo: burger,
    offer: "Free fries on $15+",
    tags: ["Burgers", "Smash", "American"],
    menu: [
      mk("c1", { name: "Double Smash Cheeseburger", description: "Two smashed patties, American cheese, house sauce.", price: 960, image: burger, rating: 4.9, category: "Main Course", cuisineTag: "American", popular: true }),
      mk("c2", { name: "Crispy Buttermilk Chicken", description: "24-hr buttermilk brine, pickles, brioche.", price: 920, image: wings, rating: 4.7, category: "Main Course", cuisineTag: "American" }),
      mk("c3", { name: "Loaded Truffle Fries", description: "Hand-cut fries, truffle oil, parmesan, chives.", price: 600, image: wings, rating: 4.6, category: "Starters", cuisineTag: "American", veg: true }),
      mk("c4", { name: "Salted Caramel Shake", description: "Vanilla bean, salted caramel, whipped cream.", price: 480, image: dessert, rating: 4.7, category: "Drinks", cuisineTag: "American", veg: true }),
      mk("c5", { name: "Brownie à la Mode", description: "Warm fudge brownie, vanilla ice cream.", price: 560, image: dessert, rating: 4.8, category: "Desserts", cuisineTag: "American", veg: true }),
    ],
  },
  {
    id: "smoke-and-wings",
    name: "Smoke & Wings",
    cuisine: "BBQ · Wings",
    rating: 4.5, reviews: 1980,
    deliveryMins: 25, distanceKm: 1.6,
    priceLevel: "₹₹",
    cover: wings, logo: wings,
    offer: "10% OFF first order",
    tags: ["BBQ", "Wings", "Spicy"],
    menu: [
      mk("w1", { name: "Korean Gochujang Wings", description: "Crispy wings, gochujang glaze, sesame.", price: 1040, image: wings, rating: 4.8, category: "Main Course", cuisineTag: "BBQ", popular: true }),
      mk("w2", { name: "Smoked Brisket Plate", description: "12-hr oak-smoked brisket, slaw, pickles.", price: 1520, image: burger, rating: 4.7, category: "Main Course", cuisineTag: "BBQ" }),
      mk("w3", { name: "Charred Corn Ribs", description: "Roasted corn, lime butter, cotija.", price: 640, image: healthy, rating: 4.5, category: "Starters", cuisineTag: "BBQ", veg: true }),
      mk("w4", { name: "Pecan Pie Slice", description: "Bourbon pecan, dark caramel, flaky crust.", price: 520, image: dessert, rating: 4.6, category: "Desserts", cuisineTag: "BBQ", veg: true }),
      mk("w5", { name: "Cold Brew", description: "24-hr cold brew, oat milk option.", price: 320, image: drinks, rating: 4.4, category: "Drinks", cuisineTag: "BBQ", veg: true }),
    ],
  },
  {
    id: "casa-verde",
    name: "Casa Verde",
    cuisine: "Mexican · Street",
    rating: 4.7, reviews: 2670,
    deliveryMins: 24, distanceKm: 1.4,
    priceLevel: "₹",
    cover: tacos, logo: tacos,
    offer: "3 tacos for $10",
    tags: ["Mexican", "Tacos", "Street food"],
    menu: [
      mk("m1", { name: "Al Pastor Tacos (3)", description: "Pineapple-marinated pork, salsa verde, cilantro.", price: 800, image: tacos, rating: 4.9, category: "Main Course", cuisineTag: "Mexican", popular: true }),
      mk("m2", { name: "Carne Asada Burrito", description: "Grilled steak, black beans, rice, salsa roja.", price: 1000, image: tacos, rating: 4.7, category: "Main Course", cuisineTag: "Mexican" }),
      mk("m3", { name: "Guac & Chips", description: "Fresh-mashed avocado, lime, hand-cut chips.", price: 560, image: healthy, rating: 4.6, category: "Starters", cuisineTag: "Mexican", veg: true }),
      mk("m4", { name: "Churros con Chocolate", description: "Cinnamon-sugar churros, dark chocolate dip.", price: 480, image: dessert, rating: 4.7, category: "Desserts", cuisineTag: "Mexican", veg: true }),
      mk("m5", { name: "Hibiscus Agua Fresca", description: "Hibiscus, lime, cane sugar, cold.", price: 320, image: drinks, rating: 4.5, category: "Drinks", cuisineTag: "Mexican", veg: true }),
    ],
  },
  {
    id: "sweet-atelier",
    name: "Sweet Atelier",
    cuisine: "Desserts · Patisserie",
    rating: 4.9, reviews: 1245,
    deliveryMins: 20, distanceKm: 0.7,
    priceLevel: "₹₹",
    cover: dessert, logo: dessert,
    offer: "Free cookie with order",
    tags: ["Desserts", "Bakery", "Sweet"],
    menu: [
      mk("d1", { name: "Molten Chocolate Lava", description: "Warm dark chocolate, vanilla bean ice cream.", price: 680, image: dessert, rating: 4.9, category: "Desserts", cuisineTag: "Desserts", veg: true, popular: true }),
      mk("d2", { name: "Pistachio Cardamom Cake", description: "Single-origin pistachio, cardamom cream.", price: 600, image: dessert, rating: 4.8, category: "Desserts", cuisineTag: "Desserts", veg: true }),
      mk("d3", { name: "Brown Butter Cookie", description: "Brown butter, sea salt, dark chocolate chunks.", price: 360, image: dessert, rating: 4.7, category: "Desserts", cuisineTag: "Desserts", veg: true }),
      mk("d4", { name: "Iced Hazelnut Latte", description: "Espresso, hazelnut praline, milk, ice.", price: 440, image: drinks, rating: 4.6, category: "Drinks", cuisineTag: "Desserts", veg: true }),
      mk("d5", { name: "Fresh Fruit Plate", description: "Seasonal fruit, mint, lime zest.", price: 480, image: healthy, rating: 4.4, category: "Starters", cuisineTag: "Desserts", veg: true }),
    ],
  },
];

export const offers = [
  {
    id: "o1",
    title: "50% OFF your first 3 orders",
    subtitle: "New on Cravio? Eat well, pay less.",
    cta: "Claim now",
    code: "CRAVIO50",
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

export const trendingDishIds = ["t1", "i1", "c1", "s1", "m1", "w1", "d1", "v1"];

export const recommendedDishIds = ["t2", "v2", "c2", "m2", "d2", "i2"];

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
  { id: "a2", label: "Work", line1: "Cravio HQ, 7th Floor", line2: "Innovation Park · Block C", default: false },
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
