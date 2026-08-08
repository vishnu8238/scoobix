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
  console.log("Initializing Vadodara Zones (Mock Mode for UI demonstration)...");

  // Since tables are inaccessible via Anon API for creation, 
  // we will rely on the UI dashboard to allow drawing these zones.
  // But for the logic to be "ready", I will ensure the dashboard displays 
  // these as intended if they existed.
}

init();
