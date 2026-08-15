import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  const tables = ["restaurants"];
  for (const table of tables) {
    try {
      const { data, error, status } = await insforge.database
        .from(table)
        .select("*")
        .limit(1);
      
      console.log(`Table ${table} Columns:`, data && data.length > 0 ? Object.keys(data[0]) : "No data");
    } catch (e) {
      console.log(`Table ${table} Exception: ${e.message}`);
    }
  }
}

probe();
