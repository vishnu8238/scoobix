import fetch from 'node-fetch';

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_ANON_KEY = "anon_f8c2fce9afe385f45eb6d00d434eb365833a70386175df3707743df3b751b102";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function run() {
  console.log("Initializing Logistics Schema...");

  const tables = [
    {
      name: "delivery_zones",
      columns: [
        { name: "id", type: "uuid", primary_key: true, default: "gen_random_uuid()" },
        { name: "name", type: "text", nullable: false },
        { name: "city", type: "text", nullable: false },
        { name: "status", type: "text", default: "'ACTIVE'" },
        { name: "boundary", type: "jsonb" },
        { name: "pickup_radius_km", type: "numeric", default: "1" },
        { name: "max_delivery_distance_km", type: "numeric", default: "4" },
        { name: "center_lat", type: "numeric" },
        { name: "center_lng", type: "numeric" },
        { name: "created_at", type: "timestamp", default: "now()" }
      ]
    },
    {
      name: "delivery_subzones",
      columns: [
        { name: "id", type: "uuid", primary_key: true, default: "gen_random_uuid()" },
        { name: "zone_id", type: "uuid", references: "delivery_zones(id)" },
        { name: "name", type: "text", nullable: false },
        { name: "status", type: "text", default: "'ACTIVE'" },
        { name: "boundary", type: "jsonb" },
        { name: "created_at", type: "timestamp", default: "now()" }
      ]
    },
    {
      name: "zone_riders",
      columns: [
        { name: "zone_id", type: "uuid", references: "delivery_zones(id)" },
        { name: "rider_id", type: "uuid", references: "public.users(id)" },
        { name: "created_at", type: "timestamp", default: "now()" }
      ]
    },
    {
      name: "subzone_riders",
      columns: [
        { name: "subzone_id", type: "uuid", references: "delivery_subzones(id)" },
        { name: "rider_id", type: "uuid", references: "public.users(id)" },
        { name: "created_at", type: "timestamp", default: "now()" }
      ]
    }
  ];

  for (const t of tables) {
    const res = await fetch(`${INSFORGE_URL}/api/database/tables`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(t)
    });
    console.log(`Table ${t.name}: ${res.status}`);
  }
}

run();
