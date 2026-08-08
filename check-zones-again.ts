import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function check() {
  const tables = ["delivery_zones", "delivery_subzones", "zones", "subzones", "regions", "delivery_regions"];
  for (const t of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/${t}?limit=1`, {
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`
      }
    });
    console.log(`Table ${t}: ${res.status}`);
  }
}
check();
