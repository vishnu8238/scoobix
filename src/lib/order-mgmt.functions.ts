import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .inputValidator(z.object({
    orderId: z.string(),
    status: z.string(),
    driverId: z.string().optional().nullable()
  }))
  .handler(async ({ data, context }) => {
    const { insforge } = context;
    const patch: any = { status: data.status };
    if (data.driverId !== undefined) patch.driver_id = data.driverId;

    const { error } = await insforge.database
      .from("orders")
      .update(patch)
      .eq("id", data.orderId);

    if (error) {
      throw new Error(error.message || "Failed to update order status");
    }

    publishTableChange("orders", "update", { id: data.orderId, ...patch });
    return { success: true };
  });
