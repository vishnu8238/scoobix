import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  const tables = [
    "cities", "zones", "logistics_zones", "delivery_zones", "subzones", "gigs", "orders", "users",
    "restaurants", "drivers", "logistics_staff", "portal_access", "audit_logs"
  ];
  
  for (const table of tables) {
    try {
      const { status, error, data } = await insforge.database
        .from(table)
        .insert([{ id: "00000000-0000-0000-0000-000000000000", dummy: true }])
        .select()
        .single();
      
      console.log(`Table ${table} INSERT Status: ${status}`);
      if (error) console.log(`Table ${table} Error: ${error.message} (Code: ${error.code})`);
    } catch (e) {
      console.log(`Table ${table} Exception: ${e.message}`);
    }
  }
}

probe();
