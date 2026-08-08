import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";
import fs from 'fs';

async function run() {
  const sql = fs.readFileSync('setup-db.sql', 'utf8');
  console.log("Running migration...");
  const res = await fetch(`${INSFORGE_URL}/api/database/query`, {
    method: "POST",
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  console.log("Migration Result (Text):", text);
  try {
    const data = JSON.parse(text);
    console.log("Migration Result (JSON):", JSON.stringify(data, null, 2));
  } catch(e) {}
}
run();
