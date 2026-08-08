import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function list() {
  // Use POST to information_schema if GET is blocked or returning strange results
  const res = await fetch(`${INSFORGE_URL}/api/database/records/information_schema.tables`, {
    method: "GET",
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`
    }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  if (Array.isArray(data)) {
    console.log("Available tables:", data.map(t => t.table_name).join(", "));
  } else {
    console.log("Error response:", JSON.stringify(data));
  }
}
list();
