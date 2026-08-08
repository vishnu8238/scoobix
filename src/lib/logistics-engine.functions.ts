import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export const acceptOrderOffer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    riderId: z.string(),
    offerId: z.string(),
  }))
  .handler(async ({ data }: { data: { orderId: string; riderId: string; offerId: string } }) => {
    const offerRes = await fetch(
      `${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}&status=eq.PENDING`, 
      { headers: HEADERS }
    );
    const offers = await offerRes.json();
    if (!offers || offers.length === 0) return { success: false, error: "OFFER_INVALID_OR_EXPIRED" };

    const offer = offers[0];
    if (new Date(offer.expires_at) < new Date()) return { success: false, error: "OFFER_EXPIRED" };

    const updateRes = await fetch(
      `${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}&status=eq.PENDING`,
      {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ status: "ACCEPTED", responded_at: new Date().toISOString() })
      }
    );
    if (!updateRes.ok) return { success: false, error: "LOCK_FAILED" };

    await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${data.orderId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ driver_id: data.riderId, status: "ACCEPTED", assignment_status: "ACCEPTED" })
    });

    publishTableChange("rider_offers", "update", { id: data.offerId, status: "ACCEPTED" });
    publishTableChange("orders", "update", { id: data.orderId, status: "ACCEPTED", driver_id: data.riderId });
    return { success: true };
  });

export const rejectOrderOffer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    offerId: z.string(),
    reason: z.string().optional(),
  }))
  .handler(async ({ data }: { data: { orderId: string; offerId: string; reason?: string } }) => {
    await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${data.offerId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ status: "REJECTED", responded_at: new Date().toISOString(), rejection_reason: data.reason })
    });
    publishTableChange("rider_offers", "update", { id: data.offerId, status: "REJECTED" });
    return { success: true };
  });

export const cleanupExpiredOffers = createServerFn({ method: "POST" })
  .handler(async () => {
    const now = new Date().toISOString();
    const res = await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?status=eq.PENDING&expires_at=lt.${now}`, { headers: HEADERS });
    const expired = await res.json();
    if (!expired?.length) return { cleaned: 0 };
    for (const offer of expired) {
      await fetch(`${INSFORGE_URL}/api/database/records/rider_offers?id=eq.${offer.id}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ status: "EXPIRED" })
      });
      publishTableChange("rider_offers", "update", { id: offer.id, status: "EXPIRED" });
    }
    return { cleaned: expired.length };
  });
