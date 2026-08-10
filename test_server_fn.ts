import { getGoogleMapsApiKey } from "./src/lib/maps-config.functions";

async function test() {
  try {
    const key = await getGoogleMapsApiKey();
    console.log("Key found:", key ? "YES (length: " + key.length + ")" : "NO");
  } catch (err) {
    console.error("Error fetching key:", err);
  }
}

test();
