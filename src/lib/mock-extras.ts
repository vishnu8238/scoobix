import { restaurants } from "./mock-data";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  ago: string;
  kind: "order" | "promo" | "system";
  unread?: boolean;
};

export const customerNotifications: AppNotification[] = [
  { id: "n1", title: "Your order is on the way 🛵", body: "Aarav is 8 min away from your address.", ago: "2 min", kind: "order", unread: true },
  { id: "n2", title: "₹100 off · CRAVIO10", body: "Tap to apply on your next order over ₹500.", ago: "1 hr", kind: "promo", unread: true },
  { id: "n3", title: "Order delivered", body: "Trattoria Verde · Rate your meal to earn 20 points.", ago: "Yesterday", kind: "order" },
  { id: "n4", title: "New restaurants near you", body: "Sakura Sushi Bar just opened in Westside.", ago: "2 days", kind: "system" },
];

export const partnerNotifications: AppNotification[] = [
  { id: "p1", title: "New order · CRV-8821", body: "Maya I. placed an order for ₹4,040.", ago: "1 min", kind: "order", unread: true },
  { id: "p2", title: "Payout settled", body: "₹96,800 transferred to your bank.", ago: "3 hr", kind: "system" },
  { id: "p3", title: "Weekly summary ready", body: "View your sales report for last week.", ago: "1 day", kind: "promo" },
];

export const riderNotifications: AppNotification[] = [
  { id: "r1", title: "New trip available", body: "Trattoria Verde → 221B Baker St · ₹600", ago: "Now", kind: "order", unread: true },
  { id: "r2", title: "Weekly bonus unlocked 🎉", body: "Earn ₹1,250 extra after 80 deliveries this week.", ago: "2 hr", kind: "promo", unread: true },
  { id: "r3", title: "Payout processed", body: "₹6,736 sent to your linked account.", ago: "Yesterday", kind: "system" },
];

export const coupons = [
  { code: "CRAVIO10", title: "10% off your order", description: "Min order ₹500", expires: "30 Jun" },
  { code: "FREESHIP", title: "Free delivery", description: "On all orders this week", expires: "28 Jun" },
  { code: "NIGHT20", title: "20% off late night", description: "Valid 10pm – 2am", expires: "31 Jul" },
  { code: "WELCOME50", title: "₹250 off · new users", description: "Apply once per account", expires: "15 Aug" },
];

export const savedLocations = [
  { id: "home", label: "Home", line: "221B Baker St · Apt 4, Westside", tag: "Home", icon: "🏠" },
  { id: "work", label: "Work", line: "Cravio HQ · Block C, 6th floor", tag: "Work", icon: "💼" },
  { id: "gym",  label: "Gym",  line: "Iron Garden, Riverside 88",        tag: "Other", icon: "🏋️" },
];

export const recentlyViewed = restaurants.slice(0, 5);

export const searchSuggestions = [
  "Biryani", "Pizza near me", "Sushi", "Healthy bowls", "Late night",
  "Free delivery", "Under 30 min", "Desserts", "Family pack",
];

export const trendingSearches = ["Truffle Carbonara", "Margherita", "Spice Symphony", "Aperol Spritz"];

export const deliveryHistory = [
  { id: "DLV-3299", restaurant: "Trattoria Verde", customer: "Maya I.", payout: 600, date: "Today · 1:42 pm", distanceKm: 2.1, status: "Delivered" },
  { id: "DLV-3298", restaurant: "Char & Crust",    customer: "Liam C.", payout: 464, date: "Today · 12:08 pm", distanceKm: 1.4, status: "Delivered" },
  { id: "DLV-3297", restaurant: "Sakura Sushi Bar",customer: "Noah K.", payout: 736, date: "Today · 11:15 am", distanceKm: 3.4, status: "Delivered" },
  { id: "DLV-3290", restaurant: "Verdant Kitchen", customer: "Olivia B.",payout: 520, date: "Yesterday",        distanceKm: 1.9, status: "Delivered" },
  { id: "DLV-3287", restaurant: "Spice Symphony",  customer: "Ravi P.", payout: 680, date: "Yesterday",        distanceKm: 2.6, status: "Delivered" },
  { id: "DLV-3281", restaurant: "Casa Verde",      customer: "Zoe W.",  payout: 0,   date: "2 days ago",       distanceKm: 0.8, status: "Cancelled" },
];

export const earningsBreakdown = {
  base: 4280,
  tips: 1000,
  bonus: 1250,
  surge: 206,
  total: 6736,
  deductions: 0,
};

export const openingHours = [
  { day: "Monday",    open: "10:00", close: "23:00", enabled: true },
  { day: "Tuesday",   open: "10:00", close: "23:00", enabled: true },
  { day: "Wednesday", open: "10:00", close: "23:00", enabled: true },
  { day: "Thursday",  open: "10:00", close: "23:30", enabled: true },
  { day: "Friday",    open: "10:00", close: "00:30", enabled: true },
  { day: "Saturday",  open: "09:00", close: "00:30", enabled: true },
  { day: "Sunday",    open: "09:00", close: "23:00", enabled: false },
];

export const menuAddons = [
  {
    dish: "Truffle Carbonara",
    variants: [
      { name: "Regular", price: 0 },
      { name: "Large", price: 320 },
      { name: "Family", price: 720 },
    ],
    addons: [
      { name: "Extra truffle shavings", price: 180 },
      { name: "Pecorino cheese", price: 90 },
      { name: "Crispy pancetta", price: 140 },
    ],
  },
  {
    dish: "Margherita Verace",
    variants: [
      { name: "10 inch", price: 0 },
      { name: "12 inch", price: 220 },
      { name: "14 inch", price: 460 },
    ],
    addons: [
      { name: "Buffalo mozzarella", price: 160 },
      { name: "Hot honey", price: 60 },
      { name: "Fresh basil", price: 40 },
    ],
  },
];

export const adminLiveOrders = Array.from({ length: 8 }).map((_, i) => ({
  id: `CRV-${8830 + i}`,
  restaurant: restaurants[i % restaurants.length].name,
  customer: ["Maya I.", "Noah K.", "Aarav M.", "Sofía R.", "Liam C.", "Yuki T.", "Ethan P.", "Olivia B."][i],
  rider: ["Aarav M.", "—", "Sofía R.", "Liam C.", "Yuki T.", "—", "Aarav M.", "Sofía R."][i],
  status: ["Preparing", "Placed", "On the way", "On the way", "Preparing", "Placed", "Delivered", "On the way"][i],
  total: 1240 + i * 312,
  city: ["Mumbai", "Delhi", "Bengaluru", "Pune", "Mumbai", "Hyderabad", "Chennai", "Bengaluru"][i],
  eta: ["12 min", "—", "6 min", "9 min", "18 min", "—", "—", "4 min"][i],
}));

export const restaurantApprovals = [
  { id: "RA-101", name: "Goa Coastal Co.",   owner: "Reema Pinto",  cuisine: "Goan · Seafood",  city: "Mumbai",     submitted: "Today",     docs: "Verified" },
  { id: "RA-102", name: "Bharat Tiffin Hub", owner: "Ankit Gupta",  cuisine: "Indian · Thali",  city: "Bengaluru",  submitted: "Yesterday", docs: "Pending"  },
  { id: "RA-103", name: "Naka Ramen",        owner: "Yuki Tanaka",  cuisine: "Japanese · Ramen",city: "Pune",       submitted: "2 days",    docs: "Verified" },
  { id: "RA-104", name: "Crust & Co.",       owner: "Marco Bianchi",cuisine: "Pizza · Pasta",   city: "Mumbai",     submitted: "3 days",    docs: "Pending"  },
];

export const commissionBreakdown = [
  { label: "Order commission (18%)", value: 8240000 },
  { label: "Delivery fee share",      value: 1864000 },
  { label: "Restaurant payouts",      value: -6080000 },
  { label: "Rider payouts",           value: -2120000 },
  { label: "Refunds",                 value: -94000 },
];
