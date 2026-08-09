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
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

async function findAuthIdentity() {
  const email = "kumarp83975@gmail.com";
  console.log("--- AUTH IDENTITY AUDIT ---");

  // Since we can't 'log in' in the shell, we search the auth users table if possible.
  // Note: /api/auth/users is usually protected, but let's check if there's a profile match 
  // that looks like a primary identity (e.g. latest login, or one that matches the provider metadata).
  
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  if (!users || users.length === 0) {
    console.log("No users found for this email.");
    return;
  }

  console.log(`Found ${users.length} user rows.`);
  
  // Sort by last_login_at to find the most recently active one
  const sorted = users.sort((a: any, b: any) => {
    const da = new Date(a.last_login_at || 0).getTime();
    const db = new Date(b.last_login_at || 0).getTime();
    return db - da;
  });

  const mostRecent = sorted[0];
  console.log("\nMOST RECENTLY ACTIVE PROFILE:");
  console.log(`ID: ${mostRecent.id}`);
  console.log(`Role: ${mostRecent.role}`);
  console.log(`Last Login: ${mostRecent.last_login_at}`);
  console.log(`Provider: ${mostRecent.provider}`);

  // Investigate the Orphan UUID
  const orphan = "5229959d-02a2-4dac-85a4-2520c209f7b3";
  console.log(`\nINVESTIGATING ORPHAN UUID: ${orphan}`);
  
  const inUsers = await raw(`/api/database/records/users?id=eq.${orphan}`);
  const inDrivers = await raw(`/api/database/records/drivers?user_id=eq.${orphan}`);
  const inManagers = await raw(`/api/database/records/merchant_managers?user_id=eq.${orphan}`);
  const asOwner = await raw(`/api/database/records/restaurants?owner_id=eq.${orphan}`);
  const asManager = await raw(`/api/database/records/restaurants?manager_id=eq.${orphan}`);

  console.log(`Exists in users: ${inUsers && inUsers.length > 0 ? "YES" : "NO"}`);
  console.log(`Exists in drivers: ${inDrivers && inDrivers.length > 0 ? "YES" : "NO"}`);
  console.log(`Exists in merchant_managers: ${inManagers && inManagers.length > 0 ? "YES" : "NO"}`);
  console.log(`Referenced as restaurant owner: ${asOwner && asOwner.length > 0 ? "YES (" + asOwner.length + " rests)" : "NO"}`);
  console.log(`Referenced as restaurant manager: ${asManager && asManager.length > 0 ? "YES (" + asManager.length + " rests)" : "NO"}`);

  // Check if any existing user UUID is actually the manager of those restaurants
  console.log("\nCHECKING IF ANY KNOWN USER UUID MANAGES THOSE RESTAURANTS:");
  const managedRestIds = asManager?.map((r: any) => r.id) || [];
  for (const u of users) {
      const manages = await raw(`/api/database/records/restaurants?manager_id=eq.${u.id}`);
      if (manages && manages.length > 0) {
          console.log(`User ${u.id} (${u.role}) manages ${manages.length} restaurants.`);
      }
  }

  console.log("--- AUDIT END ---");
}

findAuthIdentity();
