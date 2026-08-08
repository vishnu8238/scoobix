import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function test() {
  const tables = ["restaurants", "menu_items", "orders", "users", "drivers", "app_settings", "categories", "coupons", "addons", "rider_offers", "driver_tracking", "meal_subscriptions", "bulk_requests", "referrals", "wallet", "wallet_transactions", "loyalty_accounts", "reward_store", "scratch_cards"];
  for (const t of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/${t}?limit=1`, {
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`
      }
    });
    console.log(`Table ${t}: ${res.status}`);
  }
}
test();
