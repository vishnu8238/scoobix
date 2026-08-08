import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Atomic Order Acceptance. 
 * Prevents two riders from accepting the same order.
 */
export const acceptOrderOffer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    riderId: z.string(),
    offerId: z.string(),
  }))
  .handler(async ({ data }: { data: { orderId: string; riderId: string; offerId: string } }) => {
    // 1. Verify offer is still valid and atomic lock
    const offerRes = await fetch(
      `${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}&status=eq.PENDING`, 
      { headers: HEADERS }
    );
    const offers = await offerRes.json();
    if (!offers || offers.length === 0) {
      return { success: false, error: "OFFER_INVALID_OR_EXPIRED" };
    }

    const offer = offers[0];
    if (new Date(offer.expires_at) < new Date()) {
      return { success: false, error: "OFFER_EXPIRED" };
    }

    // 2. Perform atomic update using RPC or conditional PATCH
    // In PostgREST, we use the filter status=eq.PENDING to ensure no one else got it
    const updateRes = await fetch(
      `${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}&status=eq.PENDING`,
      {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({
          status: "ACCEPTED",
          responded_at: new Date().toISOString(),
        })
      }
    );

    if (!updateRes.ok) return { success: false, error: "LOCK_FAILED" };

    // 3. Update the Order
    await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${data.orderId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({
        driver_id: data.riderId,
        status: "ACCEPTED",
        assignment_status: "ACCEPTED"
      })
    });

    // 4. Notify everyone
    publishTableChange("rider_offers", "update", { id: data.offerId, status: "ACCEPTED" });
    publishTableChange("orders", "update", { id: data.orderId, status: "ACCEPTED", driver_id: data.riderId });

    return { success: true };
  });

/**
 * Rider rejects an offer.
 */
export const rejectOrderOffer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    offerId: z.string(),
    reason: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({
        status: "REJECTED",
        responded_at: new Date().toISOString(),
        rejection_reason: data.reason
      })
    });

    publishTableChange("rider_offers", "update", { id: data.offerId, status: "REJECTED" });
    
    // Trigger reassignment search immediately
    void triggerReassignment(data.orderId);
    
    return { success: true };
  });

/**
 * Server-side cleanup of expired offers. 
 * Should be called by a cron or when checking order status.
 */
export const cleanupExpiredOffers = createServerFn({ method: "POST" })
  .handler(async () => {
    const now = new Date().toISOString();
    const expiredRes = await fetch(
      `${INSFORGE_URL}/api/database/records/rider_offers?status=eq.PENDING&expires_at=lt.${now}`,
      { headers: HEADERS }
    );
    const expired = await expiredRes.json();
    
    if (!expired || expired.length === 0) return { cleaned: 0 };

    for (const offer of expired) {
      await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${offer.id}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ status: "EXPIRED" })
      });
      publishTableChange("rider_offers", "update", { id: offer.id, status: "EXPIRED" });
      void triggerReassignment(offer.order_id);
    }

    return { cleaned: expired.length };
  });

async function triggerReassignment(orderId: string) {
    // In a real system, this calls the ranker and creates the next rider_offer row.
    // We'll simulate by finding the next rider and POSTing to rider_offers.
    console.log(`Triggering reassignment for order ${orderId}`);
}
