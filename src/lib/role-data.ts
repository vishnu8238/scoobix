import { restaurants, type Dish } from "./mock-data";

export type Role = "customer" | "partner" | "rider" | "admin";

export type PartnerOrderStatus = "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "REJECTED";

export type PartnerOrder = {
  id: string;
  customer: string;
  address: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: PartnerOrderStatus;
  placedAgo: string;
  rider?: string;
  paymentMethod: string;
};

export const PARTNER_STATUS_FLOW: PartnerOrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

export const partnerOrders: PartnerOrder[] = [
  {
    id: "CRV-8821", customer: "Maya Iyer", address: "221B Baker St · Apt 4",
    items: [{ name: "Truffle Carbonara", qty: 1, price: 1480 }, { name: "Margherita Verace", qty: 1, price: 1120 }, { name: "Aperol Spritz", qty: 2, price: 720 }],
    total: 4040, status: "PLACED", placedAgo: "2 min", paymentMethod: "Visa •4242",
  },
  {
    id: "CRV-8819", customer: "Noah Kim", address: "Scoobix HQ · Block C",
    items: [{ name: "Burrata & Heirloom", qty: 2, price: 960 }, { name: "Tiramisu Classico", qty: 1, price: 680 }],
    total: 2600, status: "PLACED", placedAgo: "5 min", paymentMethod: "Apple Pay",
  },
  {
    id: "CRV-8815", customer: "Aarav Mehta", address: "12 Linden Ave",
    items: [{ name: "Truffle Carbonara", qty: 1, price: 1480 }],
    total: 1480, status: "PREPARING", placedAgo: "12 min", rider: "Sofía R.", paymentMethod: "Mastercard •8821",
  },
  {
    id: "CRV-8812", customer: "Liam Carter", address: "7th & Pine, Apt 12",
    items: [{ name: "Margherita Verace", qty: 2, price: 1120 }],
    total: 2240, status: "ACCEPTED", placedAgo: "15 min", paymentMethod: "Visa •4242",
  },
  {
    id: "CRV-8808", customer: "Yuki Tanaka", address: "Riverside 88",
    items: [{ name: "Tiramisu Classico", qty: 2, price: 680 }, { name: "Burrata & Heirloom", qty: 1, price: 960 }],
    total: 2320, status: "READY", placedAgo: "22 min", rider: "Liam C.", paymentMethod: "Cash",
  },
  {
    id: "CRV-8801", customer: "Sofía Reyes", address: "Ocean Crest 4B",
    items: [{ name: "Aperol Spritz", qty: 1, price: 720 }],
    total: 720, status: "COMPLETED", placedAgo: "1 hr", paymentMethod: "Visa •0099",
  },
  {
    id: "CRV-8788", customer: "Ethan Park", address: "Maple Square 22",
    items: [{ name: "Margherita Verace", qty: 1, price: 1120 }, { name: "Aperol Spritz", qty: 1, price: 720 }],
    total: 1840, status: "COMPLETED", placedAgo: "2 hr", paymentMethod: "Apple Pay",
  },
];

/**
 * Live view of the signed-in partner's restaurant. `restaurants` is replaced
 * in-place once the InsForge bootstrap resolves, so this must resolve lazily
 * on every property access rather than capture an index at module load.
 */
function currentPartnerRestaurant(): Restaurant {
  return restaurants[1] ?? restaurants[0];
}

export const partnerRestaurant: Restaurant = new Proxy({} as Restaurant, {
  get: (_t, prop) => Reflect.get(currentPartnerRestaurant() ?? {}, prop),
  has: (_t, prop) => prop in (currentPartnerRestaurant() ?? {}),
  ownKeys: () => Reflect.ownKeys(currentPartnerRestaurant() ?? {}),
  getOwnPropertyDescriptor: (_t, prop) =>
    Object.getOwnPropertyDescriptor(currentPartnerRestaurant() ?? {}, prop) ?? {
      configurable: true,
      enumerable: true,
      value: undefined,
    },
});

export const partnerMenu: Dish[] = new Proxy([] as Dish[], {
  get: (_t, prop) => Reflect.get(currentPartnerRestaurant()?.menu ?? [], prop),
});


export type DeliveryRequest = {
  id: string;
  restaurant: string;
  restaurantAddress: string;
  customer: string;
  customerAddress: string;
  distanceKm: number;
  payout: number;
  etaMins: number;
  itemsCount: number;
};

export const deliveryRequests: DeliveryRequest[] = [
  { id: "DLV-3301", restaurant: "Trattoria Verde", restaurantAddress: "12 Hearth Ln", customer: "Maya I.", customerAddress: "221B Baker St", distanceKm: 2.1, payout: 600, etaMins: 18, itemsCount: 4 },
  { id: "DLV-3302", restaurant: "Sakura Sushi Bar", restaurantAddress: "9 Lantern Rd", customer: "Noah K.", customerAddress: "Scoobix HQ Block C", distanceKm: 3.4, payout: 736, etaMins: 24, itemsCount: 2 },
  { id: "DLV-3303", restaurant: "Char & Crust", restaurantAddress: "5 Smoke St", customer: "Liam C.", customerAddress: "7th & Pine", distanceKm: 1.4, payout: 464, etaMins: 12, itemsCount: 3 },
];

export const riderActiveDelivery = {
  id: "DLV-3300",
  restaurant: "Trattoria Verde",
  restaurantAddress: "12 Hearth Ln, Westside",
  restaurantPhone: "+1 555 0144",
  customer: "Aarav Mehta",
  customerAddress: "221B Baker St, Apt 4",
  customerPhone: "+1 555 0192",
  itemsCount: 3,
  payout: 600,
  distanceLeftKm: 1.6,
  etaMins: 8,
  step: "TO_CUSTOMER" as "TO_RESTAURANT" | "AT_RESTAURANT" | "TO_CUSTOMER",
};

export const riderEarnings = {
  today: { total: 6736, deliveries: 11, hours: 5.5, tips: 1000 },
  week: { total: 48992, deliveries: 78, hours: 38, tips: 7360 },
  month: { total: 193440, deliveries: 312, hours: 156, tips: 31040 },
  history: [
    { day: "Mon", amount: 7400 },
    { day: "Tue", amount: 6248 },
    { day: "Wed", amount: 8368 },
    { day: "Thu", amount: 7056 },
    { day: "Fri", amount: 9704 },
    { day: "Sat", amount: 11480 },
    { day: "Sun", amount: 6736 },
  ],
};

// Admin
export const adminStats = {
  users: 48_213,
  restaurants: 1_284,
  drivers: 612,
  ordersToday: 8_421,
  revenueToday: 11424800,
  growth: { users: 8.2, restaurants: 3.1, drivers: 12.5, orders: 5.6, revenue: 9.1 },
};

export const adminUsers = Array.from({ length: 12 }).map((_, i) => ({
  id: `U-${1001 + i}`,
  name: ["Maya Iyer", "Noah Kim", "Aarav Mehta", "Sofía Reyes", "Liam Carter", "Yuki Tanaka", "Ethan Park", "Olivia Brown", "Ravi Patel", "Hannah Lee", "Mateo Garcia", "Zoe Wilson"][i],
  email: ["maya", "noah", "aarav", "sofia", "liam", "yuki", "ethan", "olivia", "ravi", "hannah", "mateo", "zoe"][i] + "@cravio.app",
  orders: Math.floor(Math.random() * 80) + 4,
  joined: ["Mar 2024", "Jan 2025", "Oct 2023", "Feb 2026", "Apr 2025", "Nov 2024", "Jun 2025", "Dec 2024", "Jul 2025", "Sep 2024", "Feb 2025", "Jan 2026"][i],
  status: i % 7 === 0 ? "Suspended" as const : "Active" as const,
}));

export const adminRestaurants = restaurants.map((r, i) => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine,
  rating: r.rating,
  orders: 200 + i * 47,
  revenue: 8000 + i * 1320,
  status: i === 5 ? "Pending" as const : "Active" as const,
  image: r.cover,
}));

export const adminDrivers = [
  "Aarav Mehta", "Sofía Reyes", "Liam Carter", "Yuki Tanaka", "Ethan Park", "Olivia Brown", "Ravi Patel",
].map((name, i) => ({
  id: `D-${201 + i}`,
  name,
  vehicle: ["Scooter", "E-bike", "Bike", "Scooter", "Car", "E-bike", "Scooter"][i],
  rating: 4.5 + Math.random() * 0.5,
  deliveries: 80 + i * 31,
  status: i === 3 ? "Offline" as const : "Online" as const,
}));

export const adminPayments = Array.from({ length: 8 }).map((_, i) => ({
  id: `PAY-${9001 + i}`,
  party: ["Trattoria Verde", "Sakura Sushi Bar", "Char & Crust", "Spice Symphony", "Verdant Kitchen", "Casa Verde", "Sweet Atelier", "Smoke & Wings"][i],
  type: i % 3 === 0 ? "Payout" as const : "Commission" as const,
  amount: 96000 + i * 280,
  date: ["Today", "Today", "Yesterday", "Yesterday", "2 days ago", "3 days ago", "3 days ago", "5 days ago"][i],
  status: i === 2 ? "Pending" as const : "Settled" as const,
}));

export const adminOrdersRecent = Array.from({ length: 10 }).map((_, i) => ({
  id: `CRV-${8800 + i}`,
  customer: ["Maya I.", "Noah K.", "Aarav M.", "Sofía R.", "Liam C.", "Yuki T.", "Ethan P.", "Olivia B.", "Ravi P.", "Hannah L."][i],
  restaurant: restaurants[i % restaurants.length].name,
  total: 1440 + i * 4.2,
  status: ["Delivered", "On the way", "Preparing", "Placed", "Delivered", "Delivered", "Cancelled", "Delivered", "On the way", "Preparing"][i] as string,
  time: ["2m", "5m", "8m", "12m", "20m", "32m", "45m", "1h", "1h", "2h"][i],
}));
