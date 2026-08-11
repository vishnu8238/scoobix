import dotenv from 'dotenv';
dotenv.config();

async function checkKey() {
  const key = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.error("API Key Missing");
    return;
  }
  
  console.log("Using Key:", key.slice(0, 6) + "...");
  
  // Test Geocoding API
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Geocoding Status:", data.status);
    if (data.error_message) {
      console.log("Error Message:", data.error_message);
    }
  } catch (e) {
    console.error("Geocoding fetch failed:", e);
  }

  // Test Directions API
  const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=Disneyland&destination=Universal+Studios+Hollywood&key=${key}`;
  try {
    const res = await fetch(directionsUrl);
    const data = await res.json();
    console.log("Directions Status:", data.status);
    if (data.error_message) {
      console.log("Error Message:", data.error_message);
    }
  } catch (e) {
    console.error("Directions fetch failed:", e);
  }
}

checkKey();
