import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` }
  });
  return res.json();
}

async function verify() {
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const email = "kumarp83975@gmail.com";
  const orphan = "5229959d-02a2-4dac-85a4-2520c209f7b3";
  const fragmented = [
    "24ac5fec-ec76-44a8-8abe-c86fd9bac8e2",
    "06bccf81-91f2-4786-88f4-5e94182c3520",
    "2bc83695-5047-4e06-805b-c1364cafa0e8",
    "9b92f964-b743-4c7f-b11d-352157bf770c",
    "2bc83695-05f5-494d-94bd-4755613c94a0",
    "e0b2911f-9e57-434a-9f65-6fff3e88b3dc",
    "c60357bf-2dfd-4d06-805b-c1364cafa0e8",
    "d380616b-823d-44e4-aa46-6f3d6ccc7b90",
    "d25b4182-1181-4d36-a32a-45221f4096d2",
    "76dafd3f-6dfa-4f22-9ff4-f72403a1e8e1",
    "a9c7e5d6-a9f8-4269-b1e3-a001a515401e",
    "32395936-63ac-4ea2-979a-cec91b14c5db",
    "b4774520-18e6-4c7b-b5f8-ed0f910ee8ca",
    "382ef022-38cd-4b2d-bd44-a2728098f062",
    "7c87a5bb-0c29-4e18-8623-d7f1e83eca4d",
    "c620f01d-3d32-48e8-bafa-c66e6e944077",
    "5682b9ca-1b8b-4c04-8676-e2cc4d0b3feb",
    "2c372773-63d7-4dfe-823c-57c5be7ca96a",
    "ef4b6089-1c3e-4a9d-873d-b08ab64479ec",
    "1e53d605-7961-4c6f-974e-33649c9f94d6",
    "7a869905-7721-4ed5-a84a-9403a8807824",
    "a88509bd-ff61-4a24-8403-1f451906848f",
    "2e7fdec3-7713-4f64-b743-4ae4558eb704"
  ];

  console.log("--- STARTING POST-MIGRATION VERIFICATION ---");

  // CHECK 1: USERS
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  console.log(`\nCHECK 1 - USERS for ${email}:`);
  console.log(`Total rows: ${users.length}`);
  users.forEach((u: any) => {
    console.log(`- ID: ${u.id}, Role: ${u.role}, Canonical: ${u.id === canonical}`);
  });
  console.log(`Duplicates remaining: ${users.filter((u: any) => u.id !== canonical).length > 0 ? "YES" : "NO"}`);

  // CHECK 2: DRIVER
  const canonDrivers = await raw(`/api/database/records/drivers?user_id=eq.${canonical}`);
  console.log(`\nCHECK 2 - DRIVERS (Canonical):`);
  console.log(`Total rows: ${canonDrivers.length}`);
  canonDrivers.forEach((d: any) => console.log(`- ID: ${d.id}, user_id: ${d.user_id}`));
  
  const fragmentedDrivers = await raw(`/api/database/records/drivers?user_id=in.(${fragmented.join(",")})`);
  console.log(`Fragmented Driver Refs: ${fragmentedDrivers.length}`);
  fragmentedDrivers.forEach((d: any) => console.log(`- ID: ${d.id}, user_id: ${d.user_id}`));

  // CHECK 3: MANAGER
  const canonManagers = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  console.log(`\nCHECK 3 - MANAGERS (Canonical):`);
  console.log(`Total rows: ${canonManagers.length}`);
  
  const fragmentedManagers = await raw(`/api/database/records/merchant_managers?user_id=in.(${fragmented.join(",")})`);
  console.log(`Fragmented Manager Refs: ${fragmentedManagers.length}`);

  // CHECK 4: RESTAURANTS
  const canonRests = await raw(`/api/database/records/restaurants?manager_id=eq.${canonical}`);
  console.log(`\nCHECK 4 - RESTAURANTS (Manager: Canonical):`);
  console.log(`Total rows: ${canonRests.length}`);
  canonRests.forEach((r: any) => console.log(`- ID: ${r.id}, Name: ${r.name}`));

  const orphanRests = await raw(`/api/database/records/restaurants?manager_id=eq.${orphan}`);
  console.log(`Orphan Manager Refs (Should be 0): ${orphanRests.length}`);

  const fragmentedRests = await raw(`/api/database/records/restaurants?or=(owner_id.in.(${fragmented.join(",")}),manager_id.in.(${fragmented.join(",")}))`);
  console.log(`Fragmented Restaurant Refs: ${fragmentedRests.length}`);

  // CHECK 5: ORPHAN REFERENCES
  console.log(`\nCHECK 5 - GENERAL FRAGMENTED SEARCH:`);
  // Checking other common tables
  const orderRefs = await raw(`/api/database/records/orders?customer_id=in.(${fragmented.join(",")})`);
  console.log(`Fragmented Order Refs: ${orderRefs.length}`);
  
  const walletRefs = await raw(`/api/database/records/wallet_transactions?user_id=in.(${fragmented.join(",")})`);
  console.log(`Fragmented Wallet Refs: ${walletRefs.length}`);
}

verify().catch(console.error);
