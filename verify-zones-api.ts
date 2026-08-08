import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function verify() {
  console.log("--- DATABASE VERIFICATION ---");
  
  const zRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_zones?city=eq.Vadodara`, { headers: HEADERS });
  const zones = await zRes.json();
  console.log(`Vadodara Zones found: ${zones.length}`);
  zones.forEach(z => console.log(` - ${z.name} (${z.id})`));

  const szRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_subzones`, { headers: HEADERS });
  const allSubzones = await szRes.json();
  
  for (const z of zones) {
    const szCount = allSubzones.filter(s => s.zone_id === z.id).length;
    console.log(`Zone ${z.name}: ${szCount} subzones`);
  }
}

verify().catch(console.error);
