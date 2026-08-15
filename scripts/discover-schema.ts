import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_ANON_KEY = "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";

const client = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

async function probe() {
  console.log("--- TABLE EXISTENCE PROBE ---");
  
  const candidates = [
    "cities", "logistics_cities", "delivery_cities",
    "zones", "logistics_zones", "delivery_zones",
    "subzones", "delivery_subzones",
    "gigs", "delivery_gigs", "slots",
    "restaurants", "orders", "users"
  ];

  for (const table of candidates) {
    // A 401/403 means it EXISTS. A 404 means it DOES NOT.
    const { status } = await client.database.from(table).select("*").limit(0);
    if (status === 200 || status === 401 || status === 403) {
      console.log(`EXISTS: ${table} (Status ${status})`);
    } else if (status === 404) {
      // Doesn't exist
    } else {
      console.log(`OTHER: ${table} (Status ${status})`);
    }
  }
}

probe().catch(console.error);
