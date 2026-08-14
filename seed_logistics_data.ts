import { createRecord, listTable } from "./src/lib/insforge-crud";

async function seedData() {
  console.log("Starting idempotent seed for Cities and Zones...");
  
  try {
    // 1. Check for existing zones to avoid duplication
    const existing = await listTable("logistics_zones", { limit: 1 });
    const existingFallback = await listTable("delivery_zones", { limit: 1 });
    
    if (existing.length > 0 || existingFallback.length > 0) {
      console.log("Data already exists. Skipping seed.");
      return;
    }

    console.log("No zones found. Seeding City 1, City 2 and Zone 1...");

    // 2. Define seed records
    // We use consistent UUID-like IDs that are safe for InsForge
    const city1Id = "c1111111-1111-4111-a111-111111111111";
    const city2Id = "c2222222-2222-4222-a222-222222222222";
    const zone1Id = "z1111111-1111-4111-a111-111111111111";

    const zonesToSeed = [
      {
        id: zone1Id,
        name: "Zone 1",
        city: "City 1",
        city_id: "City 1", // Fallback if schema uses name
        status: "ACTIVE",
        description: "Authoritative Demo Zone",
        boundary: { type: "Polygon", coordinates: [[[0,0], [0,1], [1,1], [1,0], [0,0]]] },
        center_lat: 12.9716,
        center_lng: 77.5946,
        pickup_radius_km: 5,
        max_delivery_distance_km: 10,
        max_orders_per_rider: 3,
        assignment_timeout_sec: 30
      }
    ];

    // We try both tables to be safe
    for (const table of ["logistics_zones", "delivery_zones"]) {
      try {
        console.log(`Attempting to seed to ${table}...`);
        for (const zone of zonesToSeed) {
          await createRecord(table, zone);
        }
        console.log(`Successfully seeded ${table}`);
      } catch (e: any) {
        console.warn(`Could not seed ${table}: ${e.message}`);
      }
    }

    console.log("Seed complete.");
  } catch (err: any) {
    console.error("Seed failed:", err.message);
  }
}

seedData();
