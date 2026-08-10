import { createRecord, listTable } from "./src/lib/insforge-crud";

async function run() {
  console.log("--- Initializing Phase 3 Environment ---");
  
  const tables = [
    "delivery_zones",
    "delivery_subzones",
    "rider_offers",
    "delivery_assignment_rules",
    "delivery_assignment_logs",
    "loyalty_audit_logs"
  ];

  for (const t of tables) {
    try {
      console.log("Checking table: " + t + "...");
      await listTable(t, { limit: 1 });
      console.log("Table " + t + " exists.");
    } catch (e: any) {
      if (e.status === 404) {
        console.log("Table " + t + " is MISSING (404).");
      } else {
        console.error("Error checking table " + t + ": " + e.message);
      }
    }
  }
}

run();
