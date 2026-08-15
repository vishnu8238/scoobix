import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_ANON_KEY = "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";
const TEST_EMAIL = "admin@scoobix.app"; // Using a likely admin email for probe if needed, but we'll try anon first then list users

const client = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

async function probe() {
  console.log("--- SCHEMA DISCOVERY ---");
  
  // 1. Try to list tables by querying common names and looking at errors/success
  const candidates = [
    "cities", "logistics_cities", "delivery_cities",
    "zones", "logistics_zones", "delivery_zones",
    "subzones", "delivery_subzones",
    "gigs", "delivery_gigs", "slots",
    "restaurants", "orders", "users"
  ];

  for (const table of candidates) {
    try {
      // Use a select that is likely to work even with RLS if public-read is enabled
      const { data, error, status } = await client.database.from(table).select("*").limit(1);
      if (status === 200) {
        console.log(`FOUND: ${table} (Status ${status})`);
        if (data && data.length > 0) {
          console.log(`  Columns: ${Object.keys(data[0]).join(", ")}`);
        } else {
          console.log(`  Table is empty.`);
        }
      } else if (status === 401 || status === 403) {
        console.log(`EXISTS but PROTECTED: ${table} (Status ${status})`);
      } else if (status === 404) {
        // Table doesn't exist
      } else {
        console.log(`UNKNOWN: ${table} (Status ${status}, Error: ${error?.message})`);
      }
    } catch (e: any) {
      // Ignore
    }
  }
}

probe().catch(console.error);
