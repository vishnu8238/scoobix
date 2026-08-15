import { createClient } from "@insforge/sdk";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_API_KEY,
});

async function probe() {
  const keywords = ["zone", "area", "city", "region", "delivery", "logistics", "gig", "slot", "shift", "rider", "driver", "partner", "hub", "center"];
  const results = {};

  // Try to list tables using a common Postgres trick if allowed, or just guess
  // Since we can't run raw SQL, we guess.
  const commonTables = [
    "cities", "towns", "locations", "branches",
    "zones", "delivery_zones", "logistics_zones", "service_zones", "operational_zones",
    "subzones", "delivery_subzones", "logistics_subzones",
    "gigs", "delivery_gigs", "logistics_gigs", "tasks", "missions",
    "slots", "delivery_slots", "gig_slots", "time_slots",
    "shifts", "rider_shifts", "driver_shifts",
    "riders", "drivers", "fleet", "staff",
    "hubs", "delivery_hubs", "centers", "warehouses"
  ];

  for (const table of commonTables) {
    try {
      const { status, error, data } = await insforge.database.from(table).select("*").limit(1);
      if (status !== 404 && (!error || !error.message.includes("does not exist"))) {
         results[table] = { status, error: error?.message, count: data?.length };
      }
    } catch (e) {}
  }

  console.log("PROBE RESULTS:");
  console.log(JSON.stringify(results, null, 2));
}

probe();
