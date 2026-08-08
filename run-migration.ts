import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function run() {
  const tables = [
    {
      name: "delivery_zones",
      fields: {
        name: "text",
        city: "text",
        status: "text",
        pickup_radius_km: "float8",
        max_delivery_distance_km: "float8",
        max_orders_per_rider: "int4",
        assignment_timeout_sec: "int4",
        boundary: "jsonb"
      }
    },
    {
      name: "delivery_subzones",
      fields: {
        zone_id: "uuid",
        name: "text",
        status: "text",
        boundary: "jsonb"
      }
    }
  ];

  console.log("Checking tables via records endpoint...");
  for (const table of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/${table.name}?limit=1`, {
      headers: {
        apikey: INSFORGE_ANON_KEY,
        Authorization: `Bearer ${INSFORGE_ANON_KEY}`
      }
    });
    console.log(`Table ${table.name} status: ${res.status}`);
    if (res.status === 404) {
      console.log(`Table ${table.name} not found. Attempting creation via insert trick...`);
      // Many no-code backends create the table on the first POST if it doesn't exist, 
      // or at least this reveals if we have POST access.
      const createRes = await fetch(`${INSFORGE_URL}/api/database/records/${table.name}`, {
        method: "POST",
        headers: {
          apikey: INSFORGE_ANON_KEY,
          Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ name: "Initialization Row", status: "DISABLED", city: "System" })
      });
      console.log(`Creation attempt status: ${createRes.status}`);
    }
  }
}
run();
