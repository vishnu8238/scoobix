import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  // Exhaustive list of potential table names for a delivery app
  const tables = [
    "cities", "zones", "logistics_zones", "delivery_zones", "subzones", "gigs", "orders", "users",
    "restaurants", "drivers", "rider_profiles", "staff", "logistics_staff", "partners",
    "delivery_hubs", "hubs", "areas", "regions", "territories", "slots", "shifts",
    "profiles", "memberships", "portal_access", "audit_logs", "config", "settings"
  ];
  const results = {};

  for (const table of tables) {
    try {
      const { data, error, status } = await insforge.database
        .from(table)
        .select("*")
        .limit(1);
      
      if (status !== 404 && (!error || !error.message.includes("does not exist"))) {
        results[table] = {
          exists: true,
          columns: data && data.length > 0 ? Object.keys(data[0]) : null,
          count: data?.length || 0
        };
      }
    } catch (e) {}
  }

  console.log("FOUND TABLES:");
  console.log(JSON.stringify(results, null, 2));
}

probe();
