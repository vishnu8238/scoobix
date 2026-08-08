import fetch from 'node-fetch';

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_ANON_KEY = "anon_f8c2fce9afe385f45eb6d00d434eb365833a70386175df3707743df3b751b102";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const ZONES_DATA = [
  {
    name: "WEST ZONE",
    city: "Vadodara",
    status: "ACTIVE",
    pickup_radius_km: 1,
    max_delivery_distance_km: 4,
    center_lat: 22.31,
    center_lng: 73.15,
    subzones: [
      "Akota", "Alkapuri", "Bhayli", "Atladara", "Diwalipura", "Gorwa", "Gotri", 
      "Subhanpura", "Panchvati", "Sayajigunj", "Vadiwadi", "Vasna Road", 
      "Sunpharma Road", "Bill", "Mujmahuda", "OP Road"
    ]
  },
  {
    name: "EAST ZONE",
    city: "Vadodara",
    status: "ACTIVE",
    pickup_radius_km: 1,
    max_delivery_distance_km: 4,
    center_lat: 22.31,
    center_lng: 73.22,
    subzones: [
      "Fatehgunj", "Mandvi", "Karelibaug", "Waghodia Road", "Ajwa Road", 
      "Nizampura", "Navapura", "L&T Knowledge City", "Sama", "Sayajipura", 
      "Suryanagar", "Yakutpura", "Warasiya"
    ]
  },
  {
    name: "SOUTH ZONE",
    city: "Vadodara",
    status: "ACTIVE",
    pickup_radius_km: 1,
    max_delivery_distance_km: 4,
    center_lat: 22.25,
    center_lng: 73.19,
    subzones: [
      "Manjalpur", "Tarsali", "Makarpura", "GIDC", "Manjeja", "Jambuva", "Danteshwar"
    ]
  }
];

async function init() {
  console.log("Checking for existing delivery_zones table...");
  const tableCheck = await fetch(`${INSFORGE_URL}/api/database/records/delivery_zones?limit=1`, { headers: HEADERS });
  if (!tableCheck.ok) {
     console.error("Table delivery_zones does not exist or is not accessible. Status:", tableCheck.status);
     return;
  }

  for (const z of ZONES_DATA) {
    const { subzones, ...zonePayload } = z;
    
    const d = 0.015;
    const boundary = {
      type: "Polygon",
      coordinates: [[
        [zonePayload.center_lng - d, zonePayload.center_lat - d],
        [zonePayload.center_lng + d, zonePayload.center_lat - d],
        [zonePayload.center_lng + d, zonePayload.center_lat + d],
        [zonePayload.center_lng - d, zonePayload.center_lat + d],
        [zonePayload.center_lng - d, zonePayload.center_lat - d]
      ]]
    };

    const res = await fetch(`${INSFORGE_URL}/api/database/records/delivery_zones`, {
      method: "POST",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify({ ...zonePayload, boundary })
    });
    
    if (!res.ok) {
        console.error(`Failed to create zone ${z.name}: Status ${res.status}`, await res.text());
        continue;
    }
    
    const created = await res.json();
    const zoneId = Array.isArray(created) ? created[0].id : created.id;
    console.log(`Created zone: ${z.name} (${zoneId})`);

    for (const szName of subzones) {
       const sd = 0.005;
       const sBoundary = {
         type: "Polygon",
         coordinates: [[
           [zonePayload.center_lng - sd, zonePayload.center_lat - sd],
           [zonePayload.center_lng + sd, zonePayload.center_lat - sd],
           [zonePayload.center_lng + sd, zonePayload.center_lat + sd],
           [zonePayload.center_lng - sd, zonePayload.center_lat + sd],
           [zonePayload.center_lng - sd, zonePayload.center_lat - sd]
         ]]
       };

       await fetch(`${INSFORGE_URL}/api/database/records/delivery_subzones`, {
         method: "POST",
         headers: HEADERS,
         body: JSON.stringify({
           zone_id: zoneId,
           name: szName,
           status: "ACTIVE",
           boundary: sBoundary
         })
       });
    }
    console.log(`  - Finished ${subzones.length} subzones for ${z.name}`);
  }
}

init();
