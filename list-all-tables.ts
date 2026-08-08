import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function list() {
  const res = await fetch(`${INSFORGE_URL}/api/rest/v1/`, {
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`
    }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text.slice(0, 2000));
}
list();
