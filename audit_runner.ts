import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string, method: string = "GET", body?: any) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    method,
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error ${res.status} on ${path}:`, text);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

async function audit() {
  const email = "kumarp83975@gmail.com";
  console.log("--- AUDIT START ---");

  try {
    // 1. Fetch all users for this email
    console.log(`\nFetching public.users rows for: ${email}`);
    const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
    console.log("PUBLIC USERS ROWS FOR EMAIL:");
    console.log(JSON.stringify(users, null, 2));
    console.log("USERS ROW COUNT FOR EMAIL:", users.length);

    // 2. Duplicates check
    console.log("\nChecking for duplicate emails in users table...");
    const allEmails = await raw(`/api/database/records/users?select=email`);
    const counts: Record<string, number> = {};
    allEmails.forEach((u: any) => {
      if (u.email) counts[u.email] = (counts[u.email] || 0) + 1;
    });
    const duplicates = Object.entries(counts).filter(([_, c]) => c > 1);
    console.log("TOTAL DUPLICATE EMAILS FOUND:", duplicates.length);
    if (duplicates.length > 0) {
      console.log("SAMPLE DUPLICATES:", JSON.stringify(duplicates.slice(0, 10), null, 2));
    }

    // 3. Restaurant references
    const ids = users.map((u: any) => u.id);
    const orphanCandidate = "5229959d-02a2-4dac-85a4-2520c209f7b3";
    if (!ids.includes(orphanCandidate)) ids.push(orphanCandidate);

    console.log("\nRESTAURANT REFERENCES (OWNER/MANAGER):");
    for (const id of ids) {
      const rests = await raw(`/api/database/records/restaurants?or=(owner_id.eq.${id},manager_id.eq.${id})`);
      if (rests.length > 0) {
        rests.forEach((r: any) => {
          const inUsers = users.some((u: any) => u.id === id);
          console.log(`- Restaurant: "${r.name}" (ID: ${r.id})`);
          console.log(`  Owner: ${r.owner_id}, Manager: ${r.manager_id}`);
          console.log(`  Referenced ID ${id} exists in public.users: ${inUsers ? "YES" : "NO (ORPHAN)"}`);
        });
      }
    }

    // 4. Driver references
    console.log("\nDRIVER MEMBERSHIP:");
    for (const id of ids) {
      const drivers = await raw(`/api/database/records/drivers?user_id=eq.${id}`);
      if (drivers.length > 0) {
        console.log(`- User ${id} has driver record(s)`);
      }
    }

    // 5. Merchant Manager references
    console.log("\nMANAGER MEMBERSHIP:");
    for (const id of ids) {
      const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${id}`);
      if (managers.length > 0) {
        console.log(`- User ${id} has merchant manager record(s)`);
      }
    }

  } catch (err) {
    console.error("Audit failed:", err);
  }

  console.log("\n--- AUDIT END ---");
}

audit();
