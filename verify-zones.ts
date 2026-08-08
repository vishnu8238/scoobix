
import { getZonesWithSubzones, seedVadodaraStructure, createNewZone, createNewSubzone } from './src/lib/zones.functions';

async function test() {
  console.log("Starting Zone System Verification...");
  
  // 1. Seed Check
  console.log("Seeding Vadodara structure...");
  const seedResult = await seedVadodaraStructure();
  console.log("Seed Result:", JSON.stringify(seedResult, null, 2));
  
  // 2. Retrieval Check
  const { zones, subzones } = await getZonesWithSubzones();
  console.log(`Retrieved ${zones.length} zones and ${subzones.length} subzones.`);
  
  const westZone = zones.find(z => z.name === "West Zone");
  const eastZone = zones.find(z => z.name === "East Zone");
  const southZone = zones.find(z => z.name === "South Zone");
  
  if (westZone && eastZone && southZone) {
    console.log("✅ Core zones exist.");
    const westSz = subzones.filter(s => s.zone_id === westZone.id).length;
    const eastSz = subzones.filter(s => s.zone_id === eastZone.id).length;
    const southSz = subzones.filter(s => s.zone_id === southZone.id).length;
    
    console.log(`Subzone counts: West=${westSz}/16, East=${eastSz}/13, South=${southSz}/7`);
  } else {
    console.log("❌ Missing core zones.");
  }
  
  // 3. Create Test Zone
  console.log("Creating test zone...");
  try {
    const testZone = await createNewZone({
      name: "TEST_ZONE_" + Date.now(),
      city: "TestCity",
      status: "ACTIVE",
      pickup_radius_km: 1,
      max_delivery_distance_km: 4
    });
    console.log("✅ Test zone created:", testZone.id);
  } catch (e) {
    console.log("❌ Test zone creation failed:", e.message);
  }
}

test().catch(console.error);
