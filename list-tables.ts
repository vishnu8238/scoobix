import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function list() {
  const res = await fetch(`${INSFORGE_URL}/api/database/records/information_schema.tables?table_schema=eq.public`, {
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`
    }
  });
  const data = await res.json();
  console.log("Available tables:", data.map(t => t.table_name).join(", "));
}
list();
