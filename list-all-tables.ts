import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function list() {
  // PostgREST often lists tables at the root with an empty GET
  const res = await fetch(`${INSFORGE_URL}/`, {
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`
    }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
list();
