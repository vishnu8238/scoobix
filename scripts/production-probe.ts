import { insforge } from "../src/lib/insforge";

async function probe() {
  console.log("--- PRODUCTION SCHEMA PROBE ---");
  const tables = ["restaurants", "users", "orders", "logistics_zones", "delivery_zones", "zones", "subzones", "gigs"];
  
  for (const table of tables) {
    try {
      console.log(`Probing ${table}...`);
      const { data, error, status } = await insforge.database.from(table).select("*").limit(1);
      if (error) {
        console.log(`  ${table}: Error ${status} - ${error.message}`);
      } else {
        console.log(`  ${table}: Success ${status}. Count: ${data?.length}. Columns: ${Object.keys(data?.[0] || {}).join(", ")}`);
      }
    } catch (e: any) {
      console.log(`  ${table}: Exception - ${e.message}`);
    }
  }
}

probe().catch(console.error);
