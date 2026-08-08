import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function debug() {
  console.log("Checking tables...");
  const tables = ["delivery_zones", "delivery_subzones"];
  for (const t of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/${t}`, {
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`
      }
    });
    const data = await res.json();
    console.log(`Table ${t}:`, Array.isArray(data) ? `${data.length} rows` : `Error/Object: ${JSON.stringify(data)}`);
  }
}
debug();
