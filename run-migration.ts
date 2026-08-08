import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function run() {
  const tables = ["delivery_zones", "delivery_subzones"];
  for (const table of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/${table}`, {
      method: "POST",
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000000", name: "INIT" })
    });
    console.log(`Table ${table} initialization: ${res.status}`);
    const text = await res.text();
    console.log("Response:", text);
  }
}
run();
