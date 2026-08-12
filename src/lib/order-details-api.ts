import { listTable } from "./insforge-crud";
import { isUuid, fetchOrderRow } from "./orders-api";
import { subjectTrail } from "./audit-api";

export type OrderDetails = {
  order: any;
  items: any[];
  payment: any;
  restaurant: any;
  customer: any;
  rider: any;
  history: any[];
  proofs: any;
};

export async function fetchCompleteOrderDetails(orderId: string): Promise<OrderDetails | null> {
  if (!isUuid(orderId)) return null;

  const order = await fetchOrderRow(orderId);
  if (!order) return null;

  const [items, payments, restaurant, customer, rider, history] = await Promise.all([
    listTable("order_items", { order_id: `eq.${orderId}` }),
    listTable("payments", { order_id: `eq.${orderId}`, limit: 1 }),
    order.restaurant_id ? listTable("restaurants", { id: `eq.${order.restaurant_id}`, limit: 1 }).then(r => r[0]) : null,
    order.customer_id ? listTable("users", { id: `eq.${order.customer_id}`, limit: 1 }).then(u => u[0]) : null,
    order.driver_id ? listTable("drivers", { id: `eq.${order.driver_id}`, limit: 1 }).then(d => d[0]) : null,
    subjectTrail("order", orderId),
  ]);

  return {
    order,
    items: items || [],
    payment: payments?.[0] || null,
    restaurant,
    customer,
    rider,
    history: history || [],
    proofs: {
      pickup: order.pickup_proof || null,
      delivery: order.delivery_proof || null,
    }
  };
}

export function calculateOrderFinancials(order: any) {
  const subtotal = Number(order.subtotal || 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const discount = Number(order.discount || 0);
  const taxes = Number(order.taxes || order.tax || 0);
  const totalPrice = Number(order.total_price || 0);

  // Example commission/fee logic (adjust based on actual business rules if found)
  const restaurantCommission = subtotal * 0.2; // 20%
  const processingFee = totalPrice * 0.02; // 2%
  
  return {
    subtotal,
    deliveryFee,
    discount,
    taxes,
    totalPrice,
    deductions: [
      { label: "Restaurant Commission", value: restaurantCommission },
      { label: "Processing Fee", value: processingFee },
    ],
    netToPlatform: (totalPrice - restaurantCommission - deliveryFee) // Simplified
  };
}
