import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  const schemas = ["public", "auth", "logistics", "delivery", "management"];
  const tables = ["cities", "zones", "logistics_zones", "delivery_zones", "subzones", "gigs", "orders", "users"];
  const results = {};

  for (const schema of schemas) {
    for (const table of tables) {
      try {
        const { status, error, data } = await insforge.database
          .schema(schema)
          .from(table)
          .select("*")
          .limit(1);
        
        if (status !== 404 && (!error || !error.message.includes("does not exist"))) {
           results[`${schema}.${table}`] = { status, error: error?.message, count: data?.length };
        }
      } catch (e) {
        // results[`${schema}.${table}`] = { error: e.message };
      }
    }
  }

  console.log("SCHEMA PROBE RESULTS:");
  console.log(JSON.stringify(results, null, 2));
}

probe();
