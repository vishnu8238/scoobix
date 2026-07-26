/**
 * Payments API — webhook-ready payment records.
 *
 * No gateway is wired yet (Cashfree comes later). This module owns the
 * lifecycle of rows in the `payments` table so that when a provider is
 * connected only `confirmPayment` / `failPayment` need to be called from a
 * webhook handler instead of from the client.
 *
 * Table columns: id, order_id, amount, method, status, transaction_id,
 * created_at.
 *
 * Statuses: PENDING | SUCCESS | FAILED | REFUNDED
 * Nothing in the client ever writes SUCCESS for an online payment — only COD
 * is settled locally (on delivery), everything else waits for the webhook.
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { nudgeTable } from "./realtime";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type PaymentMethod = "COD" | "UPI" | "CARD" | "WALLET" | "NETBANKING";

export type PaymentRow = {
  id: string;
  order_id?: string | null;
  amount?: number | null;
  method?: PaymentMethod | string | null;
  status?: PaymentStatus | string | null;
  transaction_id?: string | null;
  created_at?: string;
};

/** Create the PENDING record for an order. Called at checkout. */
export async function createPayment(input: {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}): Promise<PaymentRow | null> {
  const row = await createRecord<PaymentRow>("payments", {
    order_id: input.orderId,
    amount: input.amount,
    method: input.method,
    status: "PENDING",
  });
  nudgeTable("payments");
  return row;
}

async function setStatus(
  orderId: string,
  status: PaymentStatus,
  patch: Record<string, unknown> = {},
): Promise<PaymentRow | null> {
  const rows = await listTable<PaymentRow>("payments", { order_id: `eq.${orderId}`, limit: 1 });
  const row = rows[0];
  if (!row?.id) return null;
  const updated = await patchRecord<PaymentRow>("payments", row.id, { status, ...patch });
  nudgeTable("payments");
  return updated ?? { ...row, status };
}

/**
 * Mark a payment successful. Intended to be driven by a provider webhook
 * (server-side) — the only client-side caller allowed is COD settlement at
 * delivery time, where cash has genuinely changed hands.
 */
export function confirmPayment(orderId: string, transactionId?: string) {
  return setStatus(orderId, "SUCCESS", transactionId ? { transaction_id: transactionId } : {});
}

export function failPayment(orderId: string, reason?: string) {
  return setStatus(orderId, "FAILED", reason ? { transaction_id: reason.slice(0, 120) } : {});
}

export function refundPayment(orderId: string, transactionId?: string) {
  return setStatus(orderId, "REFUNDED", transactionId ? { transaction_id: transactionId } : {});
}

export function getPaymentForOrder(orderId: string): Promise<PaymentRow | null> {
  return listTable<PaymentRow>("payments", { order_id: `eq.${orderId}`, limit: 1 }).then((r) => r[0] ?? null);
}

export function listPayments(params?: Record<string, string | number | undefined>) {
  return listTable<PaymentRow>("payments", { limit: 500, order: "-created_at", ...params });
}

/**
 * Webhook contract, documented here so the future server route matches.
 *
 *   POST /api/public/payments/webhook
 *   { order_id, transaction_id, status: "SUCCESS" | "FAILED" | "REFUNDED", signature }
 *
 * The handler must verify the provider signature, then call
 * confirmPayment / failPayment / refundPayment. No client path may shortcut it.
 */
export const PAYMENT_WEBHOOK_PATH = "/api/public/payments/webhook";
