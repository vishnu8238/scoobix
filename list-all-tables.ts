import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function list() {
  const res = await fetch(`${INSFORGE_URL}/api/database/records/information_schema.columns?table_schema=eq.public&select=table_name`, {
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`
    }
  });
  const data = await res.json();
  if (Array.isArray(data)) {
    const tableNames = Array.from(new Set(data.map(c => c.table_name)));
    console.log("Available tables:", tableNames.join(", "));
  } else {
    console.log("Error response:", JSON.stringify(data));
  }
}
list();
