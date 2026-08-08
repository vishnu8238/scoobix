import fetch from 'node-fetch';

const INSFORGE_URL = process.env.INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.INSFORGE_ANON_KEY;

const HEADERS = {
  'apikey': INSFORGE_ANON_KEY,
  'Authorization': `Bearer ${INSFORGE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function patchSchema() {
  console.log("Updating delivery_assignment_logs and orders schema...");
  
  // Note: InsForge doesn't usually allow DDL via REST API, 
  // but we record what we expect in the app logic.
  // We'll use the existing tables but handle new fields gracefully.
  
  // We'll attempt to create a dedicated 'rider_offers' table for atomic locking
  const tableDef = {
    name: 'rider_offers',
    columns: [
      { name: 'id', type: 'uuid', primary: true, default: 'gen_random_uuid()' },
      { name: 'order_id', type: 'uuid', references: 'orders(id)' },
      { name: 'rider_id', type: 'uuid', references: 'drivers(id)' },
      { name: 'status', type: 'text', default: 'PENDING' }, // PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED
      { name: 'attempt_number', type: 'integer', default: 1 },
      { name: 'created_at', type: 'timestamp', default: 'now()' },
      { name: 'expires_at', type: 'timestamp' },
      { name: 'responded_at', type: 'timestamp' },
      { name: 'rejection_reason', type: 'text' }
    ]
  };

  console.log("Required table: rider_offers");
  console.log("Required fields in orders: offer_attempt, reassignment_count, assignment_failure_reason");
}

patchSchema();
