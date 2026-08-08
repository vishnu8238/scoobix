import fetch from 'node-fetch';

const INSFORGE_URL = process.env.INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.INSFORGE_ANON_KEY;

const HEADERS = {
  'apikey': INSFORGE_ANON_KEY,
  'Authorization': `Bearer ${INSFORGE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function cleanup() {
  const now = new Date().toISOString();
  console.log("Checking for expired offers at", now);
  
  try {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?status=eq.PENDING&expires_at=lt.${now}`, { headers: HEADERS });
    const expired = await res.json();
    
    if (!expired || expired.length === 0) {
      console.log("No expired offers found.");
      return;
    }

    console.log(`Found ${expired.length} expired offers. Cleaning up...`);
    
    for (const offer of expired) {
      await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${offer.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ status: 'EXPIRED' })
      });
      
      // Update order status if needed
      await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${offer.order_id}&driver_id=is.null`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ assignment_status: 'SEARCHING', updated_at: new Date().toISOString() })
      });
      
      console.log(`Expired offer ${offer.id} for order ${offer.order_id}`);
    }
  } catch (err) {
    console.error("Cleanup failed:", err.message);
  }
}

// Run every 30 seconds
setInterval(cleanup, 30000);
cleanup();
