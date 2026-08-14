import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    status: z.string(),
    driverId: z.string().optional().nullable()
  }))
  .handler(async ({ data }) => {
    const patch: any = { status: data.status };
    if (data.driverId !== undefined) patch.driver_id = data.driverId;

    const res = await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${data.orderId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify(patch)
    });

    if (!res.ok) {
      throw new Error(await res.text() || "Failed to update order status");
    }

    publishTableChange("orders", "update", { id: data.orderId, ...patch });
    return { success: true };
  });
