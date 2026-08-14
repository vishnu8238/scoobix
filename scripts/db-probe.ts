import { insforge } from "../src/lib/insforge";

async function probe() {
  const tables = [
    "cities", "zones", "subzones", 
    "logistics_cities", "logistics_zones", "logistics_subzones",
    "delivery_cities", "delivery_zones", "delivery_subzones",
    "gigs", "logistics_gigs", "orders", "users", "restaurants"
  ];

  console.log("--- InsForge Schema Probe ---");
  for (const table of tables) {
    try {
      // Probing without a token to see which tables are truly public vs protected
      const { data, error, status } = await insforge.database.from(table).select("*").limit(1);
      if (error) {
        console.log(`[${table}] Status: ${status} | Error: ${error.message}`);
      } else {
        console.log(`[${table}] Status: ${status} | Success! Found ${data?.length || 0} records.`);
        if (data && data.length > 0) {
          console.log(`Columns: ${Object.keys(data[0]).join(", ")}`);
        }
      }
    } catch (e: any) {
      console.log(`[${table}] Exception: ${e.message}`);
    }
  }
}

probe().catch(console.error);
