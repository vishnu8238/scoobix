import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  const tables = ["cities", "zones", "logistics_zones", "delivery_zones", "subzones", "gigs", "orders", "users"];
  const results = {};

  for (const table of tables) {
    try {
      // Try to select just the first row to see column names
      const { data, error, status } = await insforge.database
        .from(table)
        .select("*")
        .limit(1);
      
      results[table] = {
        status,
        exists: status !== 404 && !error?.message?.includes("does not exist"),
        error: error?.message,
        columns: data && data.length > 0 ? Object.keys(data[0]) : null,
        count: data?.length || 0
      };
    } catch (e) {
      results[table] = { error: e.message };
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

probe();
