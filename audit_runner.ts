import { raw } from "./src/lib/insforge";
import { getSession } from "./src/lib/insforge-auth";

async function audit() {
  const email = "kumarp83975@gmail.com";
  console.log("--- AUDIT START ---");

  try {
    // 1. Get current Auth Session (if any in current env)
    const session = await getSession().catch(() => null);
    console.log("AUTH USER UUID (CURRENT SESSION):", session?.id || "NO ACTIVE SESSION IN SHELL");

    // 2. Fetch all users for this email
    console.log(`\nFetching public.users rows for: ${email}`);
    const usersRes = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`, { method: "GET" });
    const users = await usersRes.json();
    console.log("PUBLIC USERS ROWS FOR EMAIL:");
    console.log(JSON.stringify(users, null, 2));
    const userCount = Array.isArray(users) ? users.length : 0;
    console.log("USERS ROW COUNT FOR EMAIL:", userCount);

    // 3. Find duplicates across all users (limited to first 1000 for safety, or we can use a count query if supported)
    console.log("\nChecking for email duplicates...");
    const allUsersRes = await raw(`/api/database/records/users?select=email`, { method: "GET" });
    const allEmails = await allUsersRes.json();
    const counts: Record<string, number> = {};
    if (Array.isArray(allEmails)) {
      allEmails.forEach((u: any) => {
        if (u.email) {
          counts[u.email] = (counts[u.email] || 0) + 1;
        }
      });
    }
    const duplicates = Object.entries(counts).filter(([_, c]) => c > 1);
    console.log("DUPLICATE EMAILS FOUND:", duplicates.length);
    if (duplicates.length > 0) {
      console.log("SAMPLES:", JSON.stringify(duplicates.slice(0, 5), null, 2));
    }

    // 4. Restaurant references
    const ids = Array.isArray(users) ? users.map((u: any) => u.id) : [];
    const orphanCandidate = "5229959d-02a2-4dac-85a4-2520c209f7b3";
    if (!ids.includes(orphanCandidate)) ids.push(orphanCandidate);

    console.log("\nRESTAURANT REFERENCES (OWNER/MANAGER):");
    for (const id of ids) {
      const restRes = await raw(`/api/database/records/restaurants?or=(owner_id.eq.${id},manager_id.eq.${id})`, { method: "GET" });
      const rests = await restRes.json();
      if (Array.isArray(rests) && rests.length > 0) {
        rests.forEach((r: any) => {
          const exists = Array.isArray(users) ? users.some((u: any) => u.id === id) : false;
          console.log(`- Restaurant: "${r.name}" (ID: ${r.id})`);
          console.log(`  Owner: ${r.owner_id}, Manager: ${r.manager_id}`);
          console.log(`  Referenced ID ${id} exists in users table: ${exists ? "YES" : "NO (ORPHAN)"}`);
        });
      }
    }

    // 5. Driver references
    console.log("\nDRIVER MEMBERSHIP:");
    for (const id of ids) {
      const driverRes = await raw(`/api/database/records/drivers?user_id=eq.${id}`, { method: "GET" });
      const drivers = await driverRes.json();
      if (Array.isArray(drivers) && drivers.length > 0) {
        console.log(`- User ${id} has driver record(s)`);
      }
    }

    // 6. Merchant Manager references
    console.log("\nMANAGER MEMBERSHIP:");
    for (const id of ids) {
      const managerRes = await raw(`/api/database/records/merchant_managers?user_id=eq.${id}`, { method: "GET" });
      const managers = await managerRes.json();
      if (Array.isArray(managers) && managers.length > 0) {
        console.log(`- User ${id} has merchant manager record(s)`);
      }
    }
  } catch (err) {
    console.error("Audit failed:", err);
  }

  console.log("\n--- AUDIT END ---");
}

audit();
